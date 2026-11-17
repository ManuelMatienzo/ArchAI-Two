import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/client.dart';
import '../api/stomp_client.dart';
import '../models/auth_model.dart';
import '../models/room_model.dart';
import '../models/uml_model.dart';
import '../services/ai_auditor_service.dart';
import '../theme/app_colors.dart';

class ChatScreen extends StatefulWidget {
  final UserSession session;
  final String roomId;
  final String roomName;
  final List<UmlClass> classes;
  final List<UmlRelationship> relationships;

  const ChatScreen({
    super.key,
    required this.session,
    required this.roomId,
    required this.roomName,
    required this.classes,
    required this.relationships,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<CollabMessage> _messages = [];
  bool _isSending = false;
  StompStatus _connectionStatus = StompStatus.desconectado;
  void Function()? _unsubChat;

  final List<String> _quickPrompts = [
    '@ArchAI Auditar 3FN',
    '@ArchAI Resumen de Clases',
    '@ArchAI Revisar Claves y Relaciones',
    '@ArchAI Generar JPA',
    '@ArchAI Generar DDL',
  ];

  @override
  void initState() {
    super.initState();
    _loadChatHistory();
    _setupConnectionListener();
    _setupChatListener();
  }

  @override
  void dispose() {
    _saveChatHistory();
    _unsubChat?.call();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadChatHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('archai_chat_history_${widget.roomId}');
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          final loaded = decoded
              .whereType<Map<String, dynamic>>()
              .map((m) => CollabMessage.fromJson(m))
              .toList();
          if (loaded.isNotEmpty && mounted) {
            setState(() {
              _messages.addAll(loaded);
            });
            _scrollToBottom();
            return;
          }
        }
      }
    } catch (_) {}

    _addInitialWelcomeMessage();
  }

  Future<void> _saveChatHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = _messages.take(50).map((m) => m.toJson()).toList();
      await prefs.setString('archai_chat_history_${widget.roomId}', jsonEncode(list));
    } catch (_) {}
  }

  void _addInitialWelcomeMessage() {
    setState(() {
      _messages.add(
        CollabMessage(
          id: 'msg-welcome',
          sender: 'ArchAI Assistant',
          senderRole: 'ARCHAI_IA',
          text: '¡Hola ${widget.session.user.name}! Estoy conectado a la sala "${widget.roomName}" (${widget.roomId}). '
              'Puedes colaborar con tu equipo en tiempo real o mencionarme con @ArchAI para auditar 3FN, generar código JPA y DDL PostgreSQL.',
          timestamp: DateTime.now(),
          isAi: true,
        ),
      );
    });
  }

  void _setupConnectionListener() {
    _connectionStatus = MobileStompClient.instance.status;
    MobileStompClient.instance.addStatusListener((status) {
      if (mounted) {
        setState(() => _connectionStatus = status);
      }
    });
  }

  void _setupChatListener() {
    _unsubChat = MobileStompClient.instance.subscribeChat(widget.roomId, (msg) {
      if (!mounted) return;
      if (msg is CollabMessage) {
        if (!_messages.any((m) => m.id == msg.id)) {
          setState(() {
            _messages.add(msg);
          });
          _scrollToBottom();
          _saveChatHistory();
        }
      }
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage([String? presetText]) async {
    final text = (presetText ?? _textController.text).trim();
    if (text.isEmpty) return;

    final myMsg = CollabMessage(
      id: 'msg-${DateTime.now().millisecondsSinceEpoch}',
      sender: widget.session.user.name,
      senderRole: widget.session.user.role,
      text: text,
      timestamp: DateTime.now(),
      isAi: false,
    );

    setState(() {
      _messages.add(myMsg);
      if (presetText == null) _textController.clear();
      _isSending = true;
    });

    _scrollToBottom();
    _saveChatHistory();

    // 1. Send via STOMP broadcast to room
    MobileStompClient.instance.sendChatMessage(widget.roomId, myMsg, widget.session.user);

    // 2. If mentions @ArchAI, trigger local audit + backend agent
    if (text.toLowerCase().contains('@archai')) {
      await _handleAiQuery(text);
    } else {
      setState(() => _isSending = false);
    }
  }

  Future<void> _handleAiQuery(String query) async {
    // 1. Check deterministic local engine first for instant, accurate answer
    final localResult = AiAuditorService.auditUmlModelWithSnippet(
      query,
      widget.classes,
      widget.relationships,
    );

    // 2. Also try backend Spring Boot /api/v1/ia/contexto if available
    String aiText = localResult.content;
    try {
      final res = await ApiClient.request(
        '/ia/contexto',
        method: 'POST',
        body: {
          'mensaje': query,
          'clasesActuales': widget.classes.map((c) => {
            'id': c.id,
            'name': c.name,
            'attributes': c.attributes.map((a) => a.toJson()).toList(),
            'methods': c.methods.map((m) => m.toJson()).toList(),
          }).toList(),
          'relacionesActuales': widget.relationships.map((r) => {
            'id': r.id,
            'sourceClassId': r.sourceId,
            'targetClassId': r.targetId,
            'relationType': r.type,
          }).toList(),
        },
        timeout: const Duration(seconds: 4),
      );

      if (res is Map && res['respuesta'] != null && res['respuesta'].toString().isNotEmpty) {
        aiText = res['respuesta'].toString();
      }
    } catch (_) {
      // Fallback cleanly to localResult (which has the complete 3FN/JPA/DDL/Architecture response)
    }

    final aiMsg = CollabMessage(
      id: 'ai-${DateTime.now().millisecondsSinceEpoch}',
      sender: 'ArchAI Assistant',
      senderRole: 'ARCHAI_IA',
      text: aiText,
      timestamp: DateTime.now(),
      isAi: true,
      codeSnippet: localResult.codeSnippet,
      targetClassId: localResult.targetClassId,
    );

    if (mounted) {
      setState(() {
        _messages.add(aiMsg);
        _isSending = false;
      });
      _scrollToBottom();
      _saveChatHistory();

      // Broadcast AI answer to room so Web sees it too
      MobileStompClient.instance.sendChatMessage(widget.roomId, aiMsg);
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copiado al portapapeles'),
        duration: const Duration(seconds: 2),
        backgroundColor: AppColors.surfaceLight,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isConnected = _connectionStatus == StompStatus.conectado;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceGlass,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, size: 20, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Chat del Equipo',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  Text(
                    '${widget.roomName} (${widget.roomId})',
                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isConnected ? AppColors.accentEmerald.withAlpha(30) : AppColors.accentRose.withAlpha(30),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isConnected ? AppColors.accentEmerald.withAlpha(100) : AppColors.accentRose.withAlpha(100),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: isConnected ? AppColors.accentEmerald : AppColors.accentRose,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    isConnected ? 'En vivo' : 'Conectando',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: isConnected ? AppColors.accentEmerald : AppColors.accentRose,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Messages list
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                itemCount: _messages.length,
                itemBuilder: (context, idx) {
                  final msg = _messages[idx];
                  final isMe = msg.sender == widget.session.user.name;
                  return _buildMessageBubble(msg, isMe);
                },
              ),
            ),

            // Quick Prompts Chips Carousel
            Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _quickPrompts.length,
                separatorBuilder: (context, index) => const SizedBox(width: 8),
                itemBuilder: (context, idx) {
                  final prompt = _quickPrompts[idx];
                  return ActionChip(
                    backgroundColor: AppColors.surfaceLight,
                    side: const BorderSide(color: AppColors.borderGlass),
                    label: Text(
                      prompt,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.secondary),
                    ),
                    onPressed: () => _sendMessage(prompt),
                  );
                },
              ),
            ),
            const SizedBox(height: 6),

            // Input row
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: const BoxDecoration(
                color: AppColors.surfaceGlass,
                border: Border(top: BorderSide(color: AppColors.borderGlass)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLight,
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: AppColors.borderGlass),
                      ),
                      child: TextField(
                        controller: _textController,
                        style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                        decoration: const InputDecoration(
                          hintText: 'Mensaje o @ArchAI...',
                          hintStyle: TextStyle(fontSize: 12, color: AppColors.textMuted),
                          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          border: InputBorder.none,
                          isDense: true,
                        ),
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: _isSending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                            )
                          : const Icon(LucideIcons.send, size: 18, color: Colors.black),
                      onPressed: _isSending ? null : () => _sendMessage(),
                      tooltip: 'Enviar mensaje',
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

  Widget _buildMessageBubble(CollabMessage msg, bool isMe) {
    final timeStr = DateFormat('HH:mm').format(msg.timestamp);

    // AI Message
    if (msg.isAi) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surfaceGhost,
          borderRadius: BorderRadius.circular(14),
          border: const Border(
            left: BorderSide(color: AppColors.primary, width: 3.5),
            top: BorderSide(color: AppColors.borderGlass),
            right: BorderSide(color: AppColors.borderGlass),
            bottom: BorderSide(color: AppColors.borderGlass),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(LucideIcons.sparkles, size: 15, color: AppColors.primary),
                const SizedBox(width: 6),
                const Text(
                  'ArchAI Co-Developer',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                ),
                const Spacer(),
                Text(timeStr, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              msg.text,
              style: const TextStyle(fontSize: 13, height: 1.45, color: AppColors.textPrimary),
            ),

            // If message includes generated code snippet
            if (msg.codeSnippet != null) ...[
              const SizedBox(height: 10),
              Container(
                decoration: BoxDecoration(
                  color: AppColors.canvasGridBackground,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.borderGlass),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: const BoxDecoration(
                        color: AppColors.surfaceLight,
                        borderRadius: BorderRadius.vertical(top: Radius.circular(9)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            msg.codeSnippet!.title,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                              color: AppColors.primary,
                            ),
                          ),
                          GestureDetector(
                            onTap: () => _copyToClipboard(msg.codeSnippet!.code, msg.codeSnippet!.title),
                            child: const Row(
                              children: [
                                Icon(LucideIcons.copy, size: 12, color: AppColors.textSecondary),
                                SizedBox(width: 4),
                                Text(
                                  'Copiar',
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(10),
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Text(
                          msg.codeSnippet!.code,
                          style: const TextStyle(
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Entity link badge if targets a class
            if (msg.targetClassId != null) ...[
              const SizedBox(height: 10),
              GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(25),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.primary.withAlpha(80)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.crosshair, size: 12, color: AppColors.primary),
                      SizedBox(width: 6),
                      Text(
                        'Ver entidad en el lienzo 360°',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }

    // User Message (Me / Teammate)
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        decoration: BoxDecoration(
          color: isMe ? AppColors.primary.withAlpha(45) : AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isMe ? AppColors.primary.withAlpha(120) : AppColors.borderGlass,
          ),
          boxShadow: [
            if (isMe)
              BoxShadow(
                color: AppColors.primary.withAlpha(20),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
          ],
        ),
        child: Column(
          crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (!isMe)
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(
                  msg.sender,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.secondary),
                ),
              ),
            Text(
              msg.text,
              style: const TextStyle(fontSize: 13, height: 1.35, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 3),
            Text(
              timeStr,
              style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}
