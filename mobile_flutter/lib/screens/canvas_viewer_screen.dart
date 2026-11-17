import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../api/rooms_api.dart';
import '../api/stomp_client.dart';
import '../models/auth_model.dart';
import '../models/notification_model.dart';
import '../models/room_model.dart';
import '../models/uml_model.dart';
import '../services/diagram_cache_service.dart';
import '../services/notifications_service.dart';
import '../theme/app_colors.dart';
import '../widgets/bottom_sheet_modal.dart';
import '../widgets/canvas_header.dart';
import '../widgets/canvas_relation_painter.dart';
import '../widgets/class_card_widget.dart';
import '../widgets/ghost_draft_banner.dart';
import '../widgets/room_participants_modal.dart';
import '../widgets/spotlight_search_bar.dart';
import 'chat_screen.dart';
import 'notifications_screen.dart';

class CanvasViewerScreen extends StatefulWidget {
  final UserSession session;
  final String roomId;
  final String roomName;
  final String? projectId;
  final String? diagramId;
  final List<UmlClass>? initialClasses;
  final List<UmlRelationship>? initialRelationships;
  final bool enableLiveSync;

  const CanvasViewerScreen({
    super.key,
    required this.session,
    required this.roomId,
    required this.roomName,
    this.projectId,
    this.diagramId,
    this.initialClasses,
    this.initialRelationships,
    this.enableLiveSync = true,
  });

  @override
  State<CanvasViewerScreen> createState() => _CanvasViewerScreenState();
}

class _CanvasViewerScreenState extends State<CanvasViewerScreen> {
  final TransformationController _transformationController = TransformationController();

  List<UmlClass> _classes = [];
  List<UmlRelationship> _relationships = [];
  List<RoomParticipant> _participants = [];
  GhostDraftProposal? _activeGhostDraft;

  final Map<String, String> _remoteDraggingUsers = {};
  final Map<String, Timer> _remoteDragTimers = {};

  String? _highlightedClassId;
  bool _isSearchOpen = false;
  int _unreadChatCount = 0;
  bool _isLoading = true;

  Timer? _pollingTimer;
  StreamSubscription<TeamNotification>? _liveNotifSub;
  void Function()? _unsubCollab;
  void Function()? _unsubPresence;
  void Function()? _unsubGhost;
  void Function()? _unsubChat;

  int _liveRevision = 0;
  bool _hasFitted = false;
  final GlobalKey _viewportKey = GlobalKey();
  String get _cacheKey => '${widget.session.user.id}:${widget.roomId}:${widget.diagramId ?? widget.projectId ?? "room"}';

  static const double _canvasSize = 3500.0;

  @override
  void initState() {
    super.initState();

    if (widget.initialClasses != null) {
      _classes = List.from(widget.initialClasses!);
      _relationships = List.from(widget.initialRelationships ?? []);
      _isLoading = false;
      if (_classes.isNotEmpty) {
        _hasFitted = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _centerCanvas();
        });
      }
    }

    _initDiagram();
    _setupStomp();
    _startBackgroundPolling();
    if (widget.enableLiveSync) _setupLiveNotifications();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _liveNotifSub?.cancel();
    for (final timer in _remoteDragTimers.values) {
      timer.cancel();
    }
    _remoteDragTimers.clear();

    _unsubCollab?.call();
    _unsubPresence?.call();
    _unsubGhost?.call();
    _unsubChat?.call();

    if (widget.enableLiveSync) {
      MobileStompClient.instance.sendLeave(widget.roomId, widget.session.user);
      MobileStompClient.instance.unsubscribeRoom(widget.roomId);
    }

    _transformationController.dispose();
    super.dispose();
  }

  void _setupLiveNotifications() {
    _liveNotifSub = NotificationsService.instance.liveNotificationsStream.listen((notif) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(LucideIcons.bell, color: AppColors.primary, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${notif.title}: ${notif.body}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          backgroundColor: AppColors.surfaceModal,
          duration: const Duration(seconds: 4),
        ),
      );
    });
  }

  Future<void> _initDiagram() async {
    // 1. Try L1/L2 cache first for instant rendering
    final revision = _liveRevision;
    final cached = await DiagramCacheService.instance.getDiagram(_cacheKey);
    if (revision == _liveRevision && cached != null && cached.classes.isNotEmpty && _classes.isEmpty) {
      if (mounted) {
        setState(() {
          _classes = cached.classes;
          _relationships = cached.relationships;
          _isLoading = false;
        });
      }
    }

    // 2. Fetch fresh diagram from backend
    await _fetchDiagramFromBackend();
  }

  Future<void> _fetchDiagramFromBackend() async {
    if (widget.roomId == 'SANDBOX-OFFLINE') return;

    final revision = _liveRevision;
    try {
      DiagramData data;
      if (widget.enableLiveSync) {
        try {
          data = await RoomsApi.getRoomDiagram(widget.roomId);
        } catch (_) {
          data = await RoomsApi.getRoomDiagram(widget.roomId, widget.projectId, widget.diagramId);
        }
      } else {
        data = await RoomsApi.getRoomDiagram(widget.roomId, widget.projectId, widget.diagramId);
      }
      if (mounted && revision == _liveRevision) {
        _applyUpdatedDiagram(data.classes, data.relationships);
      }

      final ghosts = await RoomsApi.getGhostDrafts(widget.roomId);
      if (ghosts.isNotEmpty && mounted) {
        setState(() => _activeGhostDraft = ghosts.first);
      }
    } catch (_) {
    } finally {
      if (mounted && _isLoading) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _applyUpdatedDiagram(List<UmlClass> newClasses, List<UmlRelationship> newRels) {
    final previous = jsonEncode({
      'classes': _classes.map((c) => c.toJson()).toList(),
      'relations': _relationships.map((r) => r.toJson()).toList(),
    });
    final next = jsonEncode({
      'classes': newClasses.map((c) => c.toJson()).toList(),
      'relations': newRels.map((r) => r.toJson()).toList(),
    });
    if (previous != next) {
      setState(() {
        _classes = newClasses;
        _relationships = newRels;
      });
      DiagramCacheService.instance.saveDiagram(_cacheKey, newClasses, newRels);
    }
    if (!_hasFitted && newClasses.isNotEmpty) {
      _hasFitted = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _centerCanvas();
      });
    }
  }

  void _startBackgroundPolling() {
    if (widget.roomId == 'SANDBOX-OFFLINE') return;

    // Dual Sync: 1.5-second background polling
    _pollingTimer = Timer.periodic(
        widget.enableLiveSync ? const Duration(milliseconds: 1500) : const Duration(seconds: 10), (_) {
      if (mounted && (!widget.enableLiveSync || !MobileStompClient.instance.isConnected)) {
        _fetchDiagramFromBackend();
      }
    });
  }

  void _setupStomp() {
    if (!widget.enableLiveSync || widget.roomId == 'SANDBOX-OFFLINE') return;

    final stomp = MobileStompClient.instance;

    // Subscribe to Collab topic (Real-time nodo_mover, sync)
    _unsubCollab = stomp.subscribeRoomCollab(widget.roomId, (data) {
      if (!mounted || data is! Map) return;

      final emisorId = data['emisorId']?.toString();
      if (stomp.isMyOwnInstanceEcho(emisorId, widget.session.user.id)) {
        return; // ignore own local echo
      }

      final tipo = data['tipo']?.toString();
      final payload = data['payload'];

      if (tipo == 'nodo_mover' && payload is Map) {
        final nodoId = payload['classId']?.toString() ?? payload['id']?.toString() ?? payload['nodoId']?.toString();
        final x = (payload['x'] as num?)?.toDouble();
        final y = (payload['y'] as num?)?.toDouble();
        final userName = payload['usuario']?.toString() ?? data['emisorNombre']?.toString() ?? 'Compañero';

        if (nodoId != null && x != null && y != null) {
          _liveRevision++;
          _handleRemoteNodeMove(nodoId, x, y, userName);
        }
      } else if (tipo == 'diagrama' && payload is Map && payload['classes'] is List) {
        _liveRevision++;
        final diag = RoomsApi.parseBackendDiagram(payload);
        _applyUpdatedDiagram(diag.classes, diag.relationships);
      } else if (tipo == 'diagrama_actualizado' ||
          tipo == 'sincronizacion_completa' ||
          tipo == 'cambio_modelo' ||
          tipo == 'nodo_crear' ||
          tipo == 'nodo_eliminar') {
        _fetchDiagramFromBackend();
      }
    });

    // Subscribe to Presence topic
    _unsubPresence = stomp.subscribePresence(widget.roomId, (data) {
      if (!mounted) return;
      if (data is List) {
        final list = data
            .whereType<Map<String, dynamic>>()
            .map((m) => RoomParticipant.fromJson(m))
            .toList();
        setState(() => _participants = list);
      }
    });

    // Subscribe to Ghost Drafts
    _unsubGhost = stomp.subscribeGhostDrafts(widget.roomId, (data) {
      if (!mounted || data is! Map<String, dynamic>) return;
      setState(() => _activeGhostDraft = GhostDraftProposal.fromJson(data));
    });

    // Subscribe to Chat notifications (counter)
    _unsubChat = stomp.subscribeChat(widget.roomId, (data) {
      if (!mounted) return;
      setState(() => _unreadChatCount++);
    });

    // Suscribir antes de solicitar el modelo también cuando ya hay conexión.
    unawaited(stomp.connect(
      onConnect: () {
        if (!mounted) return;
        stomp.sendJoin(widget.roomId, widget.session.user);
        stomp.sendSolicitarDiagrama(widget.roomId, widget.session.user);
      },
    ).catchError((_) {}));
  }

  void _handleRemoteNodeMove(String nodoId, double x, double y, String userName) {
    setState(() {
      final idx = _classes.indexWhere((c) => c.id == nodoId);
      if (idx != -1) {
        _classes = List.of(_classes);
        _classes[idx] = _classes[idx].copyWith(x: x, y: y);
      }
      _remoteDraggingUsers[nodoId] = userName;
    });

    // Reset moving indicator timer after 1.5s
    _remoteDragTimers[nodoId]?.cancel();
    _remoteDragTimers[nodoId] = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) {
        setState(() {
          _remoteDraggingUsers.remove(nodoId);
        });
      }
    });
  }

  void _centerOnClass(UmlClass target) {
    setState(() {
      _highlightedClassId = target.id;
      _isSearchOpen = false;
    });

    // Calculate matrix translation to center the viewport on target.x, target.y
    final screenW = MediaQuery.of(context).size.width;
    final screenH = MediaQuery.of(context).size.height;
    final scale = 1.0;
    final targetX = -(target.x * scale - screenW / 2 + 100);
    final targetY = -(target.y * scale - screenH / 2 + 100);

    final matrix = Matrix4.identity()
      ..setTranslationRaw(targetX, targetY, 0.0);

    _transformationController.value = matrix;

    // Reset highlight halo after 3 seconds
    Timer(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() => _highlightedClassId = null);
      }
    });
  }

  void _zoomIn() {
    final matrix = _transformationController.value.clone();
    matrix.multiply(Matrix4.diagonal3Values(1.25, 1.25, 1.0));
    _transformationController.value = matrix;
  }

  void _zoomOut() {
    final matrix = _transformationController.value.clone();
    matrix.multiply(Matrix4.diagonal3Values(0.8, 0.8, 1.0));
    _transformationController.value = matrix;
  }

  void _centerCanvas() {
    if (_classes.isEmpty) return;
    final box = _viewportKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final left = _classes.map((c) => c.x).reduce(math.min);
    final top = _classes.map((c) => c.y).reduce(math.min);
    final right = _classes.map((c) => c.x + c.width).reduce(math.max);
    final bottom = _classes.map((c) => c.y + math.max(c.height, 180)).reduce(math.max);
    final scale = math.min((box.size.width - 48) / math.max(right - left, 1),
        (box.size.height - 48) / math.max(bottom - top, 1)).clamp(0.05, 2.0);
    _transformationController.value = Matrix4.identity()
      ..setTranslationRaw((box.size.width - (left + right) * scale) / 2,
          (box.size.height - (top + bottom) * scale) / 2, 0)
      ..scaleByDouble(scale, scale, 1, 1);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            CanvasHeader(
              roomName: widget.roomName,
              roomId: widget.roomId,
              participantsCount: _participants.isNotEmpty ? _participants.length : 1,
              unreadChatCount: _unreadChatCount,
              isSearchOpen: _isSearchOpen,
              onBack: () => Navigator.of(context).pop(),
              onToggleSearch: () => setState(() => _isSearchOpen = !_isSearchOpen),
              onOpenParticipants: () {
                RoomParticipantsModal.show(
                  context,
                  _participants.isNotEmpty
                      ? _participants
                      : [
                          RoomParticipant(
                            id: widget.session.user.id,
                            name: widget.session.user.name,
                            role: widget.session.user.role,
                            isHost: true,
                            clientType: 'MOBILE',
                          )
                        ],
                  widget.roomName,
                );
              },
              onOpenNotifications: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => NotificationsScreen(
                      session: widget.session,
                      roomId: widget.roomId,
                    ),
                  ),
                );
              },
              onOpenChat: () {
                if (!widget.enableLiveSync) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('El chat no está disponible para este diagrama.')));
                  return;
                }
                setState(() => _unreadChatCount = 0);
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ChatScreen(
                      session: widget.session,
                      roomId: widget.roomId,
                      roomName: widget.roomName,
                      diagramId: widget.diagramId,
                      classes: _classes,
                      relationships: _relationships,
                    ),
                  ),
                );
              },
            ),

            // Spotlight search overlay if open
            if (_isSearchOpen)
              SpotlightSearchBar(
                classes: _classes,
                onSelectClass: _centerOnClass,
                onClose: () => setState(() => _isSearchOpen = false),
              ),

            // Ghost Draft suggestion banner if available
            if (_activeGhostDraft != null)
              GhostDraftBanner(
                proposal: _activeGhostDraft!,
                onReview: () {
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      backgroundColor: AppColors.surfaceModal,
                      title: Text(_activeGhostDraft!.title, style: const TextStyle(color: AppColors.textPrimary)),
                      content: SingleChildScrollView(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _activeGhostDraft!.reasoning,
                              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Clases sugeridas: ${_activeGhostDraft!.classes.map((c) => c.name).join(", ")}',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.accentEmerald),
                            ),
                          ],
                        ),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.of(ctx).pop(),
                          child: const Text('Cerrar', style: TextStyle(color: AppColors.textMuted)),
                        ),
                      ],
                    ),
                  );
                },
                onDismiss: () => setState(() => _activeGhostDraft = null),
              ),

            // 360° Interactive Canvas Viewport
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.primary),
                    )
                  : Stack(
                      children: [
                        Positioned.fill(
                          child: InteractiveViewer(
                            key: _viewportKey,
                            transformationController: _transformationController,
                            constrained: false,
                            boundaryMargin: const EdgeInsets.all(2000.0),
                            minScale: 0.05,
                            maxScale: 4.0,
                            child: Container(
                              width: _canvasSize,
                              height: _canvasSize,
                              color: AppColors.canvasGridBackground,
                              child: Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  // 1. Vector layer for orthogonal relations
                                  Positioned.fill(
                                    child: CustomPaint(
                                      painter: CanvasRelationPainter(
                                        classes: _classes,
                                        relationships: _relationships,
                                      ),
                                    ),
                                  ),

                                  // 2. Read-only class cards; positions arrive from collaborators.
                                  ..._classes.map((c) {
                                    final isHighlight = c.id == _highlightedClassId;
                                    final draggingUser = _remoteDraggingUsers[c.id];

                                    return AnimatedPositioned(
                                      key: ValueKey(c.id),
                                      duration: const Duration(milliseconds: 80),
                                      curve: Curves.easeOutQuad,
                                      left: c.x,
                                      top: c.y,
                                      child: ClassCardWidget(
                                        model: c,
                                        isHighlighted: isHighlight,
                                        remoteDraggingUser: draggingUser,
                                        onTap: () => ClassDetailModal.show(context, c),
                                      ),
                                    );
                                  }),
                                ],
                              ),
                            ),
                          ),
                        ),

                        // Bottom-left info pill
                        Positioned(
                          bottom: 16,
                          left: 16,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceGlass.withAlpha(220),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.borderGlass),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(LucideIcons.layers, size: 12, color: AppColors.primary),
                                const SizedBox(width: 6),
                                Text(
                                  '${_classes.length} clases · ${_relationships.length} rels',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                        // Bottom-right floating zoom controls
                        Positioned(
                          bottom: 16,
                          right: 16,
                          child: Container(
                            decoration: BoxDecoration(
                              color: AppColors.surfaceGlass.withAlpha(230),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.borderGlass),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withAlpha(100),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(LucideIcons.plus, size: 18, color: AppColors.textPrimary),
                                  onPressed: _zoomIn,
                                  visualDensity: VisualDensity.compact,
                                  tooltip: 'Acercar',
                                ),
                                Container(height: 1, width: 24, color: AppColors.borderGlass),
                                IconButton(
                                  icon: const Icon(LucideIcons.minus, size: 18, color: AppColors.textPrimary),
                                  onPressed: _zoomOut,
                                  visualDensity: VisualDensity.compact,
                                  tooltip: 'Alejar',
                                ),
                                Container(height: 1, width: 24, color: AppColors.borderGlass),
                                IconButton(
                                  icon: const Icon(LucideIcons.crosshair, size: 18, color: AppColors.primary),
                                  onPressed: _centerCanvas,
                                  visualDensity: VisualDensity.compact,
                                  tooltip: 'Centrar Lienzo',
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
