import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../api/client.dart';
import '../api/stomp_client.dart';
import '../models/auth_model.dart';
import '../models/room_model.dart';
import '../models/uml_model.dart';
import '../theme/app_colors.dart';

class ChatScreen extends StatefulWidget {
  final UserSession session;
  final String roomId;
  final String roomName;
  final String? diagramId;
  final List<UmlClass> classes;
  final List<UmlRelationship> relationships;

  const ChatScreen({
    super.key,
    required this.session,
    required this.roomId,
    required this.roomName,
    this.diagramId,
    required this.classes,
    required this.relationships,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final ScrollController _scrollController = ScrollController();
  final List<CollabMessage> _messages = [];
  bool _isLoadingMessages = true;
  void Function()? _unsubChat;

  @override
  void initState() {
    super.initState();
    _loadChatHistory();
    _setupChatListener();
  }

  @override
  void dispose() {
    _unsubChat?.call();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadChatHistory() async {
    if (widget.diagramId == null || widget.diagramId!.isEmpty) {
      if (mounted) setState(() => _isLoadingMessages = false);
      return;
    }
    try {
      final result = await ApiClient.request(
        '/colaboracion/salas/${Uri.encodeComponent(widget.roomId)}/mensajes?diagramId=${Uri.encodeComponent(widget.diagramId!)}',
      );
      if (!mounted) return;
      if (result is List) {
        final history = result.whereType<Map<String, dynamic>>().map(CollabMessage.fromJson).toList();
        setState(() {
          final existing = _messages.map((m) => m.id).toSet();
          _messages.insertAll(0, history.where((m) => !existing.contains(m.id)));
        });
        _scrollToBottom();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se pudieron cargar los mensajes.')));
      }
    } finally {
      if (mounted) setState(() => _isLoadingMessages = false);
    }
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

          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Messages list
            Expanded(
              child: _messages.isEmpty && !_isLoadingMessages
                  ? const Center(child: Text('Aún no hay mensajes.', style: TextStyle(color: AppColors.textSecondary)))
                  : ListView.builder(
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

            if (_isLoadingMessages)
              const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: AppColors.primary)),

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
