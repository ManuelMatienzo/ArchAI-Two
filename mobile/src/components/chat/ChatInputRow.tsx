import React, { memo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Send } from 'lucide-react-native';
import { colors } from '../../theme/colors';

interface ChatInputRowProps {
  inputMessage: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onInsertMention: () => void;
  inputRef: any;
  isFocused?: boolean;
  isKeyboardVisible?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const ChatInputRow: React.FC<ChatInputRowProps> = memo(({
  inputMessage,
  onChangeText,
  onSend,
  onInsertMention,
  inputRef,
  isFocused = false,
  isKeyboardVisible = false,
  onFocus,
  onBlur,
}) => {
  const insets = useSafeAreaInsets();
  const hasText = inputMessage.trim().length > 0;
  const isMentionActive = inputMessage.includes('@ArchAI');

  // Ajuste ergonómico del margen inferior según si el teclado está desplegado o en reposo
  const bottomPadding = isKeyboardVisible ? 8 : Math.max(insets.bottom, 10);

  return (
    <View style={[styles.inputContainer, { paddingBottom: bottomPadding }]}>
      {/* Botón de acceso directo a @ArchAI */}
      <TouchableOpacity
        style={[styles.mentionBtn, isMentionActive && styles.mentionBtnActive]}
        onPress={onInsertMention}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Mencionar a ArchAI"
      >
        <Sparkles size={16} color={isMentionActive ? colors.primary : '#e8c39e'} />
      </TouchableOpacity>

      {/* Campo de Entrada de Texto Ergonómico */}
      <TextInput
        ref={inputRef}
        style={[styles.textInput, isFocused && styles.textInputFocused]}
        value={inputMessage}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Escribe un mensaje o menciona @ArchAI..."
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="center"
        autoCapitalize="sentences"
        returnKeyType="default"
        blurOnSubmit={false}
      />

      {/* Botón de Envío */}
      <TouchableOpacity
        style={[styles.sendBtn, hasText ? styles.sendBtnActive : styles.sendBtnDisabled]}
        onPress={onSend}
        disabled={!hasText}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Enviar mensaje"
      >
        <Send
          size={17}
          color={hasText ? '#000020' : 'rgba(255,255,255,0.22)'}
        />
      </TouchableOpacity>
    </View>
  );
});

ChatInputRow.displayName = 'ChatInputRow';

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
    gap: 8,
  },
  mentionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentionBtnActive: {
    backgroundColor: 'rgba(232, 195, 158, 0.28)',
    borderColor: colors.primary,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 32, 0.65)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 9 : 7,
    color: colors.textPrimary,
    fontSize: 13.5,
    minHeight: 40,
    maxHeight: 90,
  },
  textInputFocused: {
    borderColor: 'rgba(232, 195, 158, 0.55)',
    backgroundColor: 'rgba(0, 0, 32, 0.88)',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#f5e1ce',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(232, 195, 158, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.18)',
  },
});
