import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../api/auth_api.dart';
import '../api/rooms_api.dart';
import '../models/auth_model.dart';
import '../models/room_model.dart';
import '../models/uml_model.dart';
import '../theme/app_colors.dart';
import '../widgets/glass_card.dart';
import 'canvas_viewer_screen.dart';
import 'login_screen.dart';
import 'notifications_screen.dart';
import 'settings_screen.dart';

class RoomsScreen extends StatefulWidget {
  final UserSession session;

  const RoomsScreen({super.key, required this.session});

  @override
  State<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends State<RoomsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _pinController = TextEditingController();
  final TextEditingController _projectCodeController = TextEditingController();
  final TextEditingController _projectSearchController = TextEditingController();

  final TextEditingController _newProjectNameController = TextEditingController();
  final TextEditingController _newProjectDescController = TextEditingController();
  String _selectedProjectColor = '#38BDF8';

  final TextEditingController _newDiagramTitleController = TextEditingController();
  final TextEditingController _inviteEmailController = TextEditingController();
  String _inviteRole = 'EDITOR';

  final TextEditingController _newRoomNameController = TextEditingController();

  List<ProjectItem> _projects = [];
  List<Map<String, dynamic>> _activeRooms = [];
  bool _isLoading = false;
  String _projectSearchQuery = '';
  String _selectedFilter = 'TODOS'; // 'TODOS' | 'MIS_PROYECTOS' | 'COMPARTIDOS'
  final Set<String> _expandedProjectIds = {};

  final List<String> _colorPalette = [
    '#38BDF8', // Cyan
    '#E8C39E', // Warm Sand
    '#10B981', // Emerald
    '#A855F7', // Purple
    '#F59E0B', // Amber
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _projectSearchController.addListener(() {
      setState(() {
        _projectSearchQuery = _projectSearchController.text.trim().toLowerCase();
      });
    });
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _pinController.dispose();
    _projectCodeController.dispose();
    _projectSearchController.dispose();
    _newProjectNameController.dispose();
    _newProjectDescController.dispose();
    _newDiagramTitleController.dispose();
    _inviteEmailController.dispose();
    _newRoomNameController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final pList = await RoomsApi.listUserProjects(widget.session.user.id);
      final rList = await RoomsApi.listActiveRooms(widget.session.user.id);
      if (mounted) {
        setState(() {
          _projects = pList;
          _activeRooms = rList;
        });
      }
    } catch (_) {
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _joinRoomWithPin(String pin) async {
    final cleanPin = pin.trim().toUpperCase();
    if (cleanPin.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ingresa un PIN válido para unirte')));
      return;
    }
    try {
      final room = await RoomsApi.joinRoom(cleanPin, widget.session.user);
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => CanvasViewerScreen(
        session: widget.session,
        roomId: room['roomId']?.toString() ?? cleanPin,
        roomName: room['roomName']?.toString() ?? 'Sala $cleanPin',
        projectId: room['projectId']?.toString(),
        diagramId: room['diagramId']?.toString(),
      )));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se pudo entrar a la sala. Verifica el código y vuelve a intentarlo.')));
    }
  }

  Future<void> _joinProjectWithCode() async {
    final code = _projectCodeController.text.trim().toUpperCase();
    if (code.isEmpty) return;

    setState(() => _isLoading = true);
    try {
      final proj = await RoomsApi.joinProjectByCode(code, widget.session.user.id);
      _projectCodeController.clear();
      await _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Te has unido al proyecto ${proj.name}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al unirse: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showCreateProjectDialog() {
    _newProjectNameController.clear();
    _newProjectDescController.clear();
    _selectedProjectColor = '#38BDF8';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (dialogCtx, setDialogState) => AlertDialog(
          backgroundColor: AppColors.surfaceModal,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Nuevo Proyecto de Arquitectura', style: TextStyle(color: AppColors.textPrimary, fontSize: 16)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _newProjectNameController,
                  autofocus: true,
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Nombre del proyecto *',
                    labelStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    hintText: 'ej. E-Commerce Microservicios',
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    filled: true,
                    fillColor: AppColors.surfaceLight,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _newProjectDescController,
                  maxLines: 2,
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Descripción',
                    labelStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    hintText: 'Objetivo y alcance de la arquitectura',
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    filled: true,
                    fillColor: AppColors.surfaceLight,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 14),
                const Text('Color distintivo del proyecto:', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                const SizedBox(height: 8),
                Row(
                  children: _colorPalette.map((hex) {
                    final isSel = _selectedProjectColor == hex;
                    final c = _parseColor(hex);
                    return GestureDetector(
                      onTap: () => setDialogState(() => _selectedProjectColor = hex),
                      child: Container(
                        margin: const EdgeInsets.only(right: 8),
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: c,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isSel ? Colors.white : Colors.transparent,
                            width: 2,
                          ),
                        ),
                        child: isSel ? const Icon(LucideIcons.check, size: 14, color: Colors.black) : null,
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancelar', style: TextStyle(color: AppColors.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
              onPressed: () async {
                final name = _newProjectNameController.text.trim();
                if (name.isEmpty) return;

                Navigator.of(ctx).pop();
                setState(() => _isLoading = true);

                try {
                  final proj = await RoomsApi.createProject(
                    name: name,
                    description: _newProjectDescController.text.trim(),
                    ownerId: widget.session.user.id,
                    color: _selectedProjectColor,
                  );
                  await _loadData();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Proyecto ${proj.name} creado')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error al crear proyecto: $e')),
                    );
                  }
                } finally {
                  if (mounted) setState(() => _isLoading = false);
                }
              },
              child: const Text('Crear Proyecto', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  void _showDeleteProjectConfirmation(ProjectItem proj) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceModal,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text('Eliminar Proyecto', style: TextStyle(color: AppColors.accentRose, fontSize: 16)),
        content: Text(
          '¿Estás seguro de que deseas eliminar permanentemente el proyecto "${proj.name}" y todos sus diagramas asociados?',
          style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.accentRose, foregroundColor: Colors.white),
            onPressed: () async {
              Navigator.of(ctx).pop();
              setState(() => _isLoading = true);
              try {
                final ok = await RoomsApi.deleteProject(proj.id);
                if (ok) {
                  await _loadData();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Proyecto "${proj.name}" eliminado')),
                    );
                  }
                }
              } finally {
                if (mounted) setState(() => _isLoading = false);
              }
            },
            child: const Text('Eliminar', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showLeaveProjectConfirmation(ProjectItem proj) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceModal,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text('Salir del Proyecto', style: TextStyle(color: AppColors.secondary, fontSize: 16)),
        content: Text(
          '¿Deseas dejar de ser colaborador del proyecto "${proj.name}"?',
          style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary, foregroundColor: Colors.black),
            onPressed: () async {
              Navigator.of(ctx).pop();
              setState(() => _isLoading = true);
              try {
                final ok = await RoomsApi.leaveProject(proj.id, widget.session.user.id);
                if (ok) {
                  await _loadData();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Has salido del proyecto "${proj.name}"')),
                    );
                  }
                }
              } finally {
                if (mounted) setState(() => _isLoading = false);
              }
            },
            child: const Text('Salir', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _openDiagramInStudio(ProjectItem proj, [ProjectDiagramSummary? diag]) async {
    if (diag == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Crea un diagrama para abrir el lienzo.')));
      return;
    }
    final roomId = proj.codigoAcceso.isNotEmpty ? proj.codigoAcceso : proj.id;
    try {
      final room = await RoomsApi.openDiagramRoom(diag.id, roomId);
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => CanvasViewerScreen(
        session: widget.session,
        roomId: room['roomId']?.toString() ?? roomId,
        roomName: '${proj.name} · ${diag.title}',
        projectId: proj.id,
        diagramId: diag.id,
      )));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se pudo abrir el diagrama. Intenta de nuevo.')));
    }
  }

  void _showCreateDiagramDialog(ProjectItem proj) {
    _newDiagramTitleController.clear();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceModal,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Nuevo Diagrama UML', style: TextStyle(color: AppColors.textPrimary, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Proyecto: ${proj.name}', style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              controller: _newDiagramTitleController,
              autofocus: true,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                labelText: 'Título del Diagrama *',
                labelStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                hintText: 'ej. Modelo de Dominio, Módulo de Pagos',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                filled: true,
                fillColor: AppColors.surfaceLight,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
            onPressed: () async {
              final title = _newDiagramTitleController.text.trim();
              if (title.isEmpty) return;

              Navigator.of(ctx).pop();
              setState(() => _isLoading = true);

              try {
                final created = await RoomsApi.createDiagram(
                  projectId: proj.id,
                  title: title,
                  userId: widget.session.user.id,
                );
                await _loadData();
                _expandedProjectIds.add(proj.id);

                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Diagrama "${created.title}" añadido con éxito'),
                      action: SnackBarAction(
                        label: 'Abrir',
                        textColor: AppColors.primary,
                        onPressed: () => _openDiagramInStudio(proj, created),
                      ),
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error al crear diagrama: $e')),
                  );
                }
              } finally {
                if (mounted) setState(() => _isLoading = false);
              }
            },
            child: const Text('Crear Diagrama', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showDeleteDiagramConfirmation(ProjectItem proj, ProjectDiagramSummary diag) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceModal,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text('Eliminar Diagrama', style: TextStyle(color: AppColors.accentRose, fontSize: 16)),
        content: Text(
          '¿Deseas eliminar el diagrama "${diag.title}" del proyecto "${proj.name}"?',
          style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.accentRose, foregroundColor: Colors.white),
            onPressed: () async {
              Navigator.of(ctx).pop();
              setState(() => _isLoading = true);
              try {
                final ok = await RoomsApi.deleteDiagram(diag.id);
                if (ok) {
                  await _loadData();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Diagrama "${diag.title}" eliminado')),
                    );
                  }
                }
              } finally {
                if (mounted) setState(() => _isLoading = false);
              }
            },
            child: const Text('Eliminar', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showProjectMembersModal(ProjectItem proj) {
    _inviteEmailController.clear();
    _inviteRole = 'EDITOR';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (bCtx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final members = proj.members;

          return Container(
            height: MediaQuery.of(context).size.height * 0.75,
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom,
            ),
            decoration: const BoxDecoration(
              color: AppColors.surfaceModal,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              border: Border(top: BorderSide(color: AppColors.borderGlass)),
            ),
            child: Column(
              children: [
                // Drag handle
                Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 8),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.textMuted.withAlpha(80),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                // Header
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: _parseColor(proj.iconoColor).withAlpha(40),
                        child: Icon(LucideIcons.users, color: _parseColor(proj.iconoColor), size: 15),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Equipo · ${proj.name}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              'Código: ${proj.codigoAcceso} · ${members.length} miembros',
                              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(LucideIcons.x, size: 18, color: AppColors.textMuted),
                        onPressed: () => Navigator.of(bCtx).pop(),
                      ),
                    ],
                  ),
                ),

                const Divider(height: 1, color: AppColors.borderGlass),

                // Invite Section (if owner)
                if (proj.isOwner)
                  Container(
                    margin: const EdgeInsets.all(12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLight,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.borderGlass),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Invitar Colaborador al Proyecto (CU-02)',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _inviteEmailController,
                                style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                                decoration: const InputDecoration(
                                  hintText: 'Correo o nombre de usuario...',
                                  hintStyle: TextStyle(fontSize: 11, color: AppColors.textMuted),
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  border: OutlineInputBorder(borderSide: BorderSide.none),
                                  filled: true,
                                  fillColor: AppColors.surfaceModal,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            DropdownButton<String>(
                              value: _inviteRole,
                              dropdownColor: AppColors.surfaceModal,
                              style: const TextStyle(fontSize: 11, color: AppColors.secondary, fontWeight: FontWeight.bold),
                              underline: const SizedBox(),
                              items: const [
                                DropdownMenuItem(value: 'EDITOR', child: Text('EDITOR')),
                                DropdownMenuItem(value: 'LECTOR', child: Text('LECTOR')),
                              ],
                              onChanged: (val) {
                                if (val != null) {
                                  setSheetState(() => _inviteRole = val);
                                }
                              },
                            ),
                            const SizedBox(width: 6),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.secondary,
                                foregroundColor: Colors.black,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              onPressed: () async {
                                final target = _inviteEmailController.text.trim();
                                if (target.isEmpty) return;

                                try {
                                  final newMember = await RoomsApi.inviteMember(
                                    projectId: proj.id,
                                    emailOrUsername: target,
                                    role: _inviteRole,
                                  );
                                  _inviteEmailController.clear();
                                  await _loadData();
                                  setSheetState(() {
                                    proj.members.add(newMember);
                                  });
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Colaborador $target invitado como $_inviteRole')),
                                    );
                                  }
                                } catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('No se pudo invitar: $e')),
                                    );
                                  }
                                }
                              },
                              child: const Text('Invitar', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                // Members List
                Expanded(
                  child: members.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(LucideIcons.users, size: 36, color: AppColors.textMuted.withAlpha(80)),
                              const SizedBox(height: 8),
                              const Text('No hay información detallada de miembros', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: members.length,
                          separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.borderGlass),
                          itemBuilder: (mCtx, i) {
                            final m = members[i];
                            final isOwnerMember = m.role.toUpperCase() == 'PROPIETARIO' || m.userId == proj.propietarioId;

                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(vertical: 4),
                              leading: CircleAvatar(
                                radius: 16,
                                backgroundColor: isOwnerMember
                                    ? AppColors.primary.withAlpha(40)
                                    : AppColors.secondary.withAlpha(40),
                                child: Text(
                                  m.name.isNotEmpty ? m.name[0].toUpperCase() : 'U',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: isOwnerMember ? AppColors.primary : AppColors.secondary,
                                  ),
                                ),
                              ),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      m.name,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isOwnerMember
                                          ? AppColors.primary.withAlpha(30)
                                          : AppColors.secondary.withAlpha(30),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      m.role,
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: isOwnerMember ? AppColors.primary : AppColors.secondary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              subtitle: Text(
                                m.email.isNotEmpty ? m.email : 'ID: ${m.userId}',
                                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                              ),
                              trailing: (proj.isOwner && !isOwnerMember && m.userId != widget.session.user.id)
                                  ? IconButton(
                                      icon: const Icon(LucideIcons.userMinus, size: 18, color: AppColors.accentRose),
                                      tooltip: 'Remover del proyecto',
                                      onPressed: () async {
                                        final ok = await RoomsApi.removeMember(proj.id, m.userId);
                                        if (ok) {
                                          await _loadData();
                                          setSheetState(() {
                                            proj.members.removeWhere((item) => item.userId == m.userId);
                                          });
                                          if (mounted) {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              SnackBar(content: Text('${m.name} removido del proyecto')),
                                            );
                                          }
                                        }
                                      },
                                    )
                                  : null,
                            );
                          },
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showCreateRoomDialog() {
    _newRoomNameController.clear();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceModal,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Crear Nueva Sala Colaborativa', style: TextStyle(color: AppColors.textPrimary, fontSize: 16)),
        content: TextField(
          controller: _newRoomNameController,
          autofocus: true,
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'Nombre de la sala (ej. Sprint 4 Arquitectura)',
            hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
            filled: true,
            fillColor: AppColors.surfaceLight,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
            onPressed: () async {
              final name = _newRoomNameController.text.trim();
              Navigator.of(ctx).pop();
              setState(() => _isLoading = true);
              try {
                final created = await RoomsApi.createRoom(
                  name.isNotEmpty ? name : 'Sala de Arquitectura',
                  widget.session.user,
                );
                final pin = created['roomId']?.toString() ?? 'ARC-${DateTime.now().millisecondsSinceEpoch % 10000}';
                if (mounted) {
                  _joinRoomWithPin(pin);
                }
              } catch (_) {
                final pin = 'ARC-${DateTime.now().millisecondsSinceEpoch % 10000}';
                if (mounted) {
                  _joinRoomWithPin(pin);
                }
              } finally {
                if (mounted) setState(() => _isLoading = false);
              }
            },
            child: const Text('Crear y Entrar'),
          ),
        ],
      ),
    );
  }

  Future<void> _logout() async {
    await AuthApi.logout();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  Color _parseColor(String hex) {
    try {
      final clean = hex.replaceAll('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return AppColors.secondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.session.user;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: Column(
          children: [
            // Top user bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: AppColors.surfaceGlass,
                border: Border(bottom: BorderSide(color: AppColors.borderGlass)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppColors.primary,
                    radius: 18,
                    child: Text(
                      user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.name,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          user.role,
                          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.bell, size: 20, color: AppColors.textSecondary),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => NotificationsScreen(session: widget.session),
                        ),
                      );
                    },
                    tooltip: 'Actividad del Equipo',
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.settings, size: 20, color: AppColors.textSecondary),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SettingsScreen()),
                      );
                    },
                    tooltip: 'Ajustes',
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.logOut, size: 20, color: AppColors.accentRose),
                    onPressed: _logout,
                    tooltip: 'Cerrar Sesión',
                  ),
                ],
              ),
            ),

            // Tabs
            TabBar(
              controller: _tabController,
              indicatorColor: AppColors.primary,
              indicatorWeight: 2.5,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textSecondary,
              tabs: const [
                Tab(text: 'Hub de Proyectos'),
                Tab(text: 'Salas en Vivo'),
                Tab(text: 'Modo Individual'),
              ],
            ),

            // Tab contents
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        // Tab 1: Hub de Proyectos (CU-02)
                        _buildProjectsHubTab(),

                        // Tab 2: Salas en Vivo (CU-03)
                        _buildRoomsTab(),

                        // Tab 3: Modo Individual (Offline Sandbox)
                        _buildIndividualModeTab(),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProjectsHubTab() {
    final mineCount = _projects.where((p) => p.isOwner).length;
    final sharedCount = _projects.where((p) => !p.isOwner).length;

    final filteredProjects = _projects.where((p) {
      if (_selectedFilter == 'MIS_PROYECTOS' && !p.isOwner) return false;
      if (_selectedFilter == 'COMPARTIDOS' && p.isOwner) return false;

      if (_projectSearchQuery.isEmpty) return true;
      final q = _projectSearchQuery;
      return p.name.toLowerCase().contains(q) ||
          p.description.toLowerCase().contains(q) ||
          p.codigoAcceso.toLowerCase().contains(q);
    }).toList();

    final totalMembers = _projects.fold<int>(0, (sum, p) => sum + p.memberCount);
    final totalDiagrams = _projects.fold<int>(
      0,
      (sum, p) => sum + (p.diagrams.isNotEmpty ? p.diagrams.length : p.totalDiagrams),
    );
    final totalClasses = _projects.fold<int>(
      0,
      (sum, p) => sum + p.diagrams.fold<int>(0, (dSum, d) => dSum + d.totalClasses),
    );
    final maturity = _projects.isEmpty
        ? 60
        : (60 + totalDiagrams * 5 + totalClasses * 2).clamp(60, 95);

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. Hero Metrics Panel (4 KPIs: Proyectos, Miembros, Diagramas, Madurez)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surfaceGlass,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.borderGlass),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildMetricColumn('${_projects.length}', 'Proyectos', LucideIcons.folder, AppColors.primary),
                Container(height: 28, width: 1, color: AppColors.borderGlass),
                _buildMetricColumn('$totalMembers', 'Miembros', LucideIcons.users, AppColors.secondary),
                Container(height: 28, width: 1, color: AppColors.borderGlass),
                _buildMetricColumn('$totalDiagrams', 'Diagramas', LucideIcons.layers, AppColors.accentEmerald),
                Container(height: 28, width: 1, color: AppColors.borderGlass),
                _buildMetricColumn('$maturity%', 'Madurez', LucideIcons.shieldCheck, AppColors.primary),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // 2. Action Buttons: [ + Nuevo Proyecto ] y [ 🔑 Unirse con Código ]
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(LucideIcons.plus, size: 18),
                  label: const Text('Nuevo Proyecto', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  onPressed: _showCreateProjectDialog,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.secondary,
                    side: const BorderSide(color: AppColors.secondary),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(LucideIcons.key, size: 16),
                  label: const Text('Unirse con Código', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        backgroundColor: AppColors.surfaceModal,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        title: const Text('Unirse a un Proyecto (CU-02)', style: TextStyle(color: AppColors.textPrimary, fontSize: 15)),
                        content: TextField(
                          controller: _projectCodeController,
                          autofocus: true,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                          decoration: InputDecoration(
                            labelText: 'Código de acceso',
                            labelStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                            hintText: 'ej. SISTEM-1071',
                            hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                            filled: true,
                            fillColor: AppColors.surfaceLight,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          ),
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            child: const Text('Cancelar', style: TextStyle(color: AppColors.textMuted)),
                          ),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary, foregroundColor: Colors.black),
                            onPressed: () {
                              Navigator.of(ctx).pop();
                              _joinProjectWithCode();
                            },
                            child: const Text('Unirse al Proyecto', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // 3. Filter Chips: [ Todos ] [ Mis Proyectos ] [ Compartidos ]
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('TODOS', 'Todos (${_projects.length})'),
                const SizedBox(width: 8),
                _buildFilterChip('MIS_PROYECTOS', 'Mis Proyectos ($mineCount)'),
                const SizedBox(width: 8),
                _buildFilterChip('COMPARTIDOS', 'Compartidos ($sharedCount)'),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 4. Search input
          Container(
            decoration: BoxDecoration(
              color: AppColors.surfaceLight,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.borderGlass),
            ),
            child: TextField(
              controller: _projectSearchController,
              style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Buscar por nombre o código (ej. SISTEM-1071)...',
                hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                prefixIcon: const Icon(LucideIcons.search, size: 18, color: AppColors.textMuted),
                suffixIcon: _projectSearchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(LucideIcons.x, size: 16, color: AppColors.textMuted),
                        onPressed: () => _projectSearchController.clear(),
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                isDense: true,
              ),
            ),
          ),

          const SizedBox(height: 14),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Espacios de Trabajo (${filteredProjects.length})',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              if (_projectSearchQuery.isNotEmpty)
                Text(
                  'Filtrado por: "$_projectSearchQuery"',
                  style: const TextStyle(fontSize: 11, color: AppColors.secondary),
                ),
            ],
          ),
          const SizedBox(height: 10),

          // 5. Project Cards List
          if (filteredProjects.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 36),
              child: Center(
                child: Column(
                  children: [
                    Icon(LucideIcons.folderOpen, size: 48, color: AppColors.textMuted.withAlpha(90)),
                    const SizedBox(height: 10),
                    Text(
                      _projectSearchQuery.isEmpty
                          ? 'No tienes proyectos asignados en esta sección'
                          : 'No se encontraron proyectos con ese criterio',
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
                      icon: const Icon(LucideIcons.plus, size: 16),
                      label: const Text('Crear Primer Proyecto', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      onPressed: _showCreateProjectDialog,
                    ),
                  ],
                ),
              ),
            )
          else
            ...filteredProjects.map((proj) {
              return _buildProjectCard(proj);
            }),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String filterKey, String label) {
    final isSelected = _selectedFilter == filterKey;
    return GestureDetector(
      onTap: () => setState(() => _selectedFilter = filterKey),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withAlpha(35) : AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.borderGlass,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? AppColors.primary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildMetricColumn(String count, String label, IconData icon, Color color) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(
              count,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
        ),
      ],
    );
  }

  Widget _buildProjectCard(ProjectItem proj) {
    final projColor = _parseColor(proj.iconoColor);
    final isExpanded = _expandedProjectIds.contains(proj.id);
    final effectiveDiagrams = proj.diagrams;
    final totalDiags = effectiveDiagrams.isNotEmpty ? effectiveDiagrams.length : proj.totalDiagrams;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: AppColors.surfaceGlass,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderGlass),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(80),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row: Color icon, Title, Access Code pill, popup menu
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: projColor.withAlpha(40),
                      child: Icon(LucideIcons.gitFork, color: projColor, size: 18),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            proj.name,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          // Access code chip with 1-tap copy
                          GestureDetector(
                            onTap: () {
                              Clipboard.setData(ClipboardData(text: proj.codigoAcceso));
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Código ${proj.codigoAcceso} copiado al portapapeles'),
                                  duration: const Duration(seconds: 2),
                                  backgroundColor: AppColors.surfaceLight,
                                ),
                              );
                            },
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary.withAlpha(30),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(color: AppColors.primary.withAlpha(80)),
                                  ),
                                  child: Text(
                                    proj.codigoAcceso,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(LucideIcons.copy, size: 11, color: AppColors.textMuted),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Actions menu
                    PopupMenuButton<String>(
                      icon: const Icon(LucideIcons.moreVertical, size: 18, color: AppColors.textMuted),
                      color: AppColors.surfaceModal,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      onSelected: (val) {
                        if (val == 'add_diagram') {
                          _showCreateDiagramDialog(proj);
                        } else if (val == 'members') {
                          _showProjectMembersModal(proj);
                        } else if (val == 'copy_code') {
                          Clipboard.setData(ClipboardData(text: proj.codigoAcceso));
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Código ${proj.codigoAcceso} copiado')),
                          );
                        } else if (val == 'delete') {
                          _showDeleteProjectConfirmation(proj);
                        } else if (val == 'leave') {
                          _showLeaveProjectConfirmation(proj);
                        }
                      },
                      itemBuilder: (ctx) => [
                        const PopupMenuItem(
                          value: 'add_diagram',
                          child: Row(
                            children: [
                              Icon(LucideIcons.plusCircle, size: 16, color: AppColors.primary),
                              SizedBox(width: 8),
                              Text('Añadir Diagrama UML', style: TextStyle(color: AppColors.textPrimary, fontSize: 12)),
                            ],
                          ),
                        ),
                        const PopupMenuItem(
                          value: 'members',
                          child: Row(
                            children: [
                              Icon(LucideIcons.users, size: 16, color: AppColors.secondary),
                              SizedBox(width: 8),
                              Text('Gestionar Miembros', style: TextStyle(color: AppColors.textPrimary, fontSize: 12)),
                            ],
                          ),
                        ),
                        const PopupMenuItem(
                          value: 'copy_code',
                          child: Row(
                            children: [
                              Icon(LucideIcons.copy, size: 16, color: AppColors.textSecondary),
                              SizedBox(width: 8),
                              Text('Copiar Código Acceso', style: TextStyle(color: AppColors.textPrimary, fontSize: 12)),
                            ],
                          ),
                        ),
                        const PopupMenuDivider(),
                        if (proj.isOwner)
                          const PopupMenuItem(
                            value: 'delete',
                            child: Row(
                              children: [
                                Icon(LucideIcons.trash2, size: 16, color: AppColors.accentRose),
                                SizedBox(width: 8),
                                Text('Eliminar proyecto', style: TextStyle(color: AppColors.accentRose, fontSize: 12)),
                              ],
                            ),
                          )
                        else
                          const PopupMenuItem(
                            value: 'leave',
                            child: Row(
                              children: [
                                Icon(LucideIcons.logOut, size: 16, color: AppColors.secondary),
                                SizedBox(width: 8),
                                Text('Salir del proyecto', style: TextStyle(color: AppColors.secondary, fontSize: 12)),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 8),

                // Description
                Text(
                  proj.description.isNotEmpty ? proj.description : 'Sin descripción proporcionada.',
                  style: const TextStyle(fontSize: 12, height: 1.35, color: AppColors.textSecondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),

                const SizedBox(height: 12),
                const Divider(height: 1, color: AppColors.borderGlass),
                const SizedBox(height: 10),

                // Meta Bar: Role Badge + Quick Action Pills
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: proj.isOwner ? AppColors.primary.withAlpha(30) : AppColors.secondary.withAlpha(30),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: proj.isOwner ? AppColors.primary.withAlpha(90) : AppColors.secondary.withAlpha(90),
                        ),
                      ),
                      child: Text(
                        proj.isOwner ? 'Propietario' : 'Colaborador',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: proj.isOwner ? AppColors.primary : AppColors.secondary,
                        ),
                      ),
                    ),
                    const Spacer(),

                    // Button: Members modal
                    InkWell(
                      borderRadius: BorderRadius.circular(6),
                      onTap: () => _showProjectMembersModal(proj),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.borderGlass),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(LucideIcons.users, size: 13, color: AppColors.secondary),
                            const SizedBox(width: 4),
                            Text(
                              '${proj.memberCount}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.secondary),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Button: Toggle Diagrams
                    InkWell(
                      borderRadius: BorderRadius.circular(6),
                      onTap: () {
                        setState(() {
                          if (isExpanded) {
                            _expandedProjectIds.remove(proj.id);
                          } else {
                            _expandedProjectIds.add(proj.id);
                          }
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isExpanded ? AppColors.primary.withAlpha(30) : AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isExpanded ? AppColors.primary : AppColors.borderGlass,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(LucideIcons.layers, size: 13, color: isExpanded ? AppColors.primary : AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              '$totalDiags diags',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: isExpanded ? AppColors.primary : AppColors.textMuted,
                              ),
                            ),
                            const SizedBox(width: 2),
                            Icon(
                              isExpanded ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                              size: 14,
                              color: isExpanded ? AppColors.primary : AppColors.textMuted,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Button: Open Studio
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                      icon: const Icon(LucideIcons.play, size: 14),
                      label: const Text('Abrir', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      onPressed: () => _openDiagramInStudio(
                        proj,
                        effectiveDiagrams.isNotEmpty ? effectiveDiagrams.first : null,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Expandable Diagrams Section
          if (isExpanded)
            Container(
              decoration: BoxDecoration(
                color: Colors.black.withAlpha(60),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(14)),
                border: const Border(top: BorderSide(color: AppColors.borderGlass)),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Diagramas UML del Proyecto',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                      ),
                      GestureDetector(
                        onTap: () => _showCreateDiagramDialog(proj),
                        child: const Row(
                          children: [
                            Icon(LucideIcons.plus, size: 14, color: AppColors.primary),
                            SizedBox(width: 2),
                            Text('Añadir', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (effectiveDiagrams.isEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      width: double.infinity,
                      child: Column(
                        children: [
                          Icon(LucideIcons.layers, size: 28, color: AppColors.textMuted.withAlpha(60)),
                          const SizedBox(height: 6),
                          const Text(
                            'No hay diagramas aún en este proyecto',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                          ),
                          const SizedBox(height: 8),
                          TextButton.icon(
                            style: TextButton.styleFrom(
                              foregroundColor: AppColors.primary,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            ),
                            icon: const Icon(LucideIcons.plus, size: 14),
                            label: const Text('Crear Primer Diagrama', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            onPressed: () => _showCreateDiagramDialog(proj),
                          ),
                        ],
                      ),
                    )
                  else
                    ...effectiveDiagrams.map((diag) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.borderGlass),
                        ),
                        child: Row(
                          children: [
                            const Icon(LucideIcons.layers, size: 16, color: AppColors.accentEmerald),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    diag.title,
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    '${diag.totalClasses} clases · ${diag.totalRelations} rels',
                                    style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                                  ),
                                ],
                              ),
                            ),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.surfaceGlass,
                                foregroundColor: AppColors.primary,
                                side: const BorderSide(color: AppColors.primary),
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                              ),
                              onPressed: () => _openDiagramInStudio(proj, diag),
                              child: const Text('Lienzo', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                            ),
                            if (proj.isOwner) ...[
                              const SizedBox(width: 4),
                              IconButton(
                                icon: const Icon(LucideIcons.trash2, size: 15, color: AppColors.accentRose),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                tooltip: 'Eliminar Diagrama',
                                onPressed: () => _showDeleteDiagramConfirmation(proj, diag),
                              ),
                            ],
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRoomsTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Join with PIN card
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Entrar con PIN de Sala en Vivo',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.borderGlass),
                        ),
                        child: TextField(
                          controller: _pinController,
                          style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                          decoration: const InputDecoration(
                            hintText: 'ej. ARC-GRUPO04',
                            hintStyle: TextStyle(fontSize: 12, color: AppColors.textMuted),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () => _joinRoomWithPin(_pinController.text),
                      child: const Text('Entrar', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Create room button
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.surfaceLight,
              foregroundColor: AppColors.primary,
              side: const BorderSide(color: AppColors.primary),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(LucideIcons.plus, size: 18),
            label: const Text('Crear Nueva Sala Colaborativa', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: _showCreateRoomDialog,
          ),

          const SizedBox(height: 20),

          const Text(
            'Salas Activas en el Servidor',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textMuted),
          ),
          const SizedBox(height: 8),

          if (_activeRooms.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 30),
              child: Center(
                child: Column(
                  children: [
                    Icon(LucideIcons.doorClosed, size: 40, color: AppColors.textMuted.withAlpha(100)),
                    const SizedBox(height: 8),
                    const Text('No hay salas activas en este momento', style: TextStyle(color: AppColors.textMuted)),
                  ],
                ),
              ),
            )
          else
            ..._activeRooms.map((room) {
              final pin = room['pin'] ?? room['id'];
              return Card(
                color: AppColors.surfaceGlass,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppColors.borderGlass),
                ),
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  leading: CircleAvatar(
                    backgroundColor: AppColors.accentEmerald.withAlpha(30),
                    child: const Icon(LucideIcons.radio, color: AppColors.accentEmerald, size: 20),
                  ),
                  title: Text(
                    room['name'] ?? 'Sala $pin',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  subtitle: Text(
                    'PIN: $pin · ${room['activeUsers'] ?? 1} conectados',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  trailing: const Icon(LucideIcons.chevronRight, size: 14, color: AppColors.textMuted),
                  onTap: () => _joinRoomWithPin(pin),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildIndividualModeTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.secondary.withAlpha(30),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(LucideIcons.plane, color: AppColors.secondary, size: 24),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Modo Viaje / Sandbox',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Sin conexión a red obligatoria',
                          style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Text(
                'Accede a un lienzo 360° individual con un modelo UML de ejemplo (Usuario, Pedido, Producto). '
                'Podrás explorar la navegación 2D, inspeccionar clases y generar código Java Spring Boot y SQL PostgreSQL.',
                style: TextStyle(fontSize: 13, height: 1.4, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(LucideIcons.play, size: 18),
                label: const Text('Abrir Sandbox Individual', style: TextStyle(fontWeight: FontWeight.bold)),
                onPressed: () {
                  final mockClasses = [
                    UmlClass(
                      id: 'c-user',
                      name: 'Usuario',
                      stereotype: 'Entity',
                      tableName: 'usuarios',
                      x: 80,
                      y: 100,
                      attributes: [
                        UmlAttribute(id: 'a1', name: 'id', type: 'Long', isPrimaryKey: true, visibility: '-'),
                        UmlAttribute(id: 'a2', name: 'email', type: 'String', visibility: '-'),
                        UmlAttribute(id: 'a3', name: 'nombre', type: 'String', visibility: '-'),
                      ],
                      methods: [
                        UmlMethod(id: 'm1', name: 'autenticar', returnType: 'boolean', visibility: '+'),
                      ],
                    ),
                    UmlClass(
                      id: 'c-order',
                      name: 'Pedido',
                      stereotype: 'Entity',
                      tableName: 'pedidos',
                      x: 380,
                      y: 100,
                      attributes: [
                        UmlAttribute(id: 'a4', name: 'id', type: 'Long', isPrimaryKey: true, visibility: '-'),
                        UmlAttribute(id: 'a5', name: 'usuarioId', type: 'Long', isForeignKey: true, visibility: '-'),
                        UmlAttribute(id: 'a6', name: 'total', type: 'BigDecimal', visibility: '-'),
                      ],
                      methods: [
                        UmlMethod(id: 'm2', name: 'calcularTotal', returnType: 'BigDecimal', visibility: '+'),
                      ],
                    ),
                    UmlClass(
                      id: 'c-prod',
                      name: 'Producto',
                      stereotype: 'Entity',
                      tableName: 'productos',
                      x: 380,
                      y: 380,
                      attributes: [
                        UmlAttribute(id: 'a7', name: 'id', type: 'Long', isPrimaryKey: true, visibility: '-'),
                        UmlAttribute(id: 'a8', name: 'precio', type: 'BigDecimal', visibility: '-'),
                        UmlAttribute(id: 'a9', name: 'stock', type: 'Integer', visibility: '-'),
                      ],
                      methods: [
                        UmlMethod(id: 'm3', name: 'descontarStock', returnType: 'void', visibility: '+'),
                      ],
                    ),
                  ];

                  final mockRels = [
                    UmlRelationship(
                      id: 'r1',
                      sourceId: 'c-user',
                      targetId: 'c-order',
                      type: 'ASSOCIATION_1_N',
                      sourceMultiplicity: '1',
                      targetMultiplicity: '0..*',
                    ),
                    UmlRelationship(
                      id: 'r2',
                      sourceId: 'c-order',
                      targetId: 'c-prod',
                      type: 'COMPOSITION',
                      sourceMultiplicity: '1',
                      targetMultiplicity: '1..*',
                    ),
                  ];

                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => CanvasViewerScreen(
                        session: widget.session,
                        roomId: 'SANDBOX-OFFLINE',
                        roomName: 'Lienzo Sandbox',
                        initialClasses: mockClasses,
                        initialRelationships: mockRels,
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
