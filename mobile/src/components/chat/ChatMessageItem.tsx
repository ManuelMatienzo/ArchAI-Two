import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  Bot,
  Sparkles,
  CheckCheck,
  Clock,
  Code2,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react-native';
import { CollabMessage } from '../../types/uml';
import { colors } from '../../theme/colors';

interface ChatMessageItemProps {
  item: CollabMessage;
  currentUser: { name: string; role: string };
}

const getRoleBadgeInfo = (role?: string) => {
  switch (role) {
    case 'ARQUITECTO':
      return {
        label: 'Arquitecto',
        bg: 'rgba(232, 195, 158, 0.15)',
        border: 'rgba(232, 195, 158, 0.40)',
        color: colors.primary,
      };
    case 'REVISOR':
      return {
        label: 'Revisor',
        bg: 'rgba(56, 189, 248, 0.15)',
        border: 'rgba(56, 189, 248, 0.40)',
        color: '#38bdf8',
      };
    case 'ARCHAI_IA':
      return {
        label: 'Co-Developer',
        bg: 'rgba(192, 132, 252, 0.15)',
        border: 'rgba(192, 132, 252, 0.40)',
        color: '#c084fc',
      };
    default:
      return {
        label: 'Ing. Móvil',
        bg: 'rgba(52, 211, 153, 0.15)',
        border: 'rgba(52, 211, 153, 0.40)',
        color: '#34d399',
      };
  }
};

const getAvatarBg = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [
    'rgba(30, 41, 59, 0.95)',
    'rgba(23, 26, 74, 0.95)',
    'rgba(31, 41, 55, 0.95)',
    'rgba(15, 23, 42, 0.95)',
  ];
  return hues[Math.abs(hash) % hues.length];
};

export const ChatMessageItem: React.FC<ChatMessageItemProps> = memo(({
  item,
  currentUser,
}) => {
  const [copied, setCopied] = useState(false);

  const isMyMessage =
    item.sender === currentUser.name ||
    item.senderRole === 'DESARROLLADOR_MOVIL' ||
    item.senderRole === 'Desarrollador Móvil';

  const isAi =
    item.isAiResponse ||
    item.senderRole === 'ARCHAI_IA' ||
    item.senderRole === 'Agente IA Co-Developer' ||
    item.sender.includes('ArchAI');

  const roleInfo = getRoleBadgeInfo(item.senderRole);

  const handleCopyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <View
      style={[
        styles.msgBubbleRow,
        isMyMessage ? styles.rowRight : styles.rowLeft,
      ]}
    >
      {/* Avatar para colegas y para la IA */}
      {!isMyMessage && (
        <View
          style={[
            styles.avatarCircle,
            {
              backgroundColor: isAi
                ? 'rgba(47, 44, 121, 0.90)'
                : getAvatarBg(item.sender),
            },
            isAi && styles.aiAvatarCircle,
          ]}
        >
          {isAi ? (
            <Bot size={15} color="#e8c39e" />
          ) : (
            <Text style={styles.avatarInitial}>
              {item.sender.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      )}

      {/* Burbuja Principal */}
      <View
        style={[
          styles.msgBubble,
          isMyMessage && styles.myBubble,
          isAi && styles.aiBubble,
        ]}
      >
        {/* Cabecera de la burbuja */}
        <View style={styles.bubbleHeader}>
          <View style={styles.senderBox}>
            {isAi ? (
              <View style={styles.aiTagPill}>
                <Sparkles size={10} color="#e8c39e" />
                <Text style={styles.aiTagText}>Co-Developer</Text>
              </View>
            ) : (
              !isMyMessage &&
              roleInfo && (
                <View
                  style={[
                    styles.roleTagPill,
                    {
                      backgroundColor: roleInfo.bg,
                      borderColor: roleInfo.border,
                    },
                  ]}
                >
                  <Text style={[styles.roleTagText, { color: roleInfo.color }]}>
                    {roleInfo.label}
                  </Text>
                </View>
              )
            )}
            <Text
              style={[
                styles.senderName,
                isAi && styles.aiSenderName,
                isMyMessage && styles.mySenderName,
              ]}
            >
              {isMyMessage ? 'Tú' : item.sender}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
            {isMyMessage && (
              <View style={{ marginLeft: 4 }}>
                {item.status === 'enviando' ? (
                  <Clock size={11} color={colors.textMuted} />
                ) : item.status === 'fallido' ? (
                  <AlertCircle size={11} color="#f87171" />
                ) : (
                  <CheckCheck size={13} color="#e8c39e" />
                )}
              </View>
            )}
          </View>
        </View>

        {/* Contenido del texto */}
        <Text style={[styles.msgContent, isAi && styles.aiMsgContent]}>
          {item.content}
        </Text>

        {/* Bloque de código si estuviese adjunto */}
        {item.codeSnippet && (
          <View style={styles.codeSnippetCard}>
            <View style={styles.codeSnippetHeader}>
              <View style={styles.codeSnippetHeaderLeft}>
                <Code2 size={12} color="#e8c39e" />
                <Text style={styles.codeSnippetLang}>
                  {item.codeSnippet.language.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.snippetCopyBtn}
                onPress={() => handleCopyCode(item.codeSnippet!.code)}
              >
                {copied ? (
                  <Check size={11} color="#4ade80" />
                ) : (
                  <Copy size={11} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text style={styles.codeSnippetCode}>
                {item.codeSnippet.code}
              </Text>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  msgBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '88%',
  },
  rowLeft: {
    alignSelf: 'flex-start',
  },
  rowRight: {
    alignSelf: 'flex-end',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  aiAvatarCircle: {
    backgroundColor: 'rgba(47, 44, 121, 0.85)',
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  msgBubble: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    padding: 11,
  },
  myBubble: {
    backgroundColor: 'rgba(232, 195, 158, 0.16)',
    borderColor: 'rgba(232, 195, 158, 0.38)',
    borderBottomRightRadius: 3,
  },
  aiBubble: {
    backgroundColor: 'rgba(47, 44, 121, 0.35)',
    borderLeftWidth: 3.5,
    borderLeftColor: colors.primary,
    borderColor: 'rgba(232, 195, 158, 0.30)',
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  aiTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(232, 195, 158, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(232, 195, 158, 0.40)',
  },
  aiTagText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  roleTagPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  senderName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  aiSenderName: {
    color: colors.primary,
  },
  mySenderName: {
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: 10,
    marginLeft: 6,
  },
  msgContent: {
    color: colors.textPrimary,
    fontSize: 13.5,
    lineHeight: 19,
  },
  aiMsgContent: {
    color: '#ffffff',
    lineHeight: 20,
  },
  codeSnippetCard: {
    marginTop: 8,
    backgroundColor: '#050814',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.25)',
    padding: 8,
  },
  codeSnippetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  codeSnippetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  snippetCopyBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(232, 195, 158, 0.25)',
  },
  codeSnippetLang: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  codeSnippetCode: {
    color: '#38bdf8',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
