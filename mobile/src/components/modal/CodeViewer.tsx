import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Check } from 'lucide-react-native';
import { formatCodeWithLineNumbers } from '../../services/codegen/codeGenerators';
import { colors } from '../../theme/colors';

interface CodeViewerProps {
  code: string;
  languageLabel: string;
  icon?: React.ReactNode;
}

/**
 * Visor de código fuente de alto contraste con gutter de números de línea,
 * tipografía monospace y botón de copiado al portapapeles con feedback visual.
 */
export const CodeViewer: React.FC<CodeViewerProps> = memo(({
  code,
  languageLabel,
  icon,
}) => {
  const [copied, setCopied] = useState(false);
  const lines = formatCodeWithLineNumbers(code);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  return (
    <View style={styles.container}>
      {/* Barra Superior: Etiqueta de Lenguaje y Botón de Copiado */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={styles.languageLabel}>{languageLabel}</Text>
        </View>

        <TouchableOpacity
          style={[styles.copyButton, copied && styles.copyButtonSuccess]}
          onPress={handleCopy}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Copiar código al portapapeles"
        >
          {copied ? (
            <>
              <Check size={13} color="#4ade80" style={styles.btnIcon} />
              <Text style={styles.copyButtonSuccessText}>Copiado</Text>
            </>
          ) : (
            <>
              <Copy size={13} color={colors.primary} style={styles.btnIcon} />
              <Text style={styles.copyButtonText}>Copiar Código</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Área de Visualización de Código con Números de Línea */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        style={styles.codeScrollView}
        contentContainerStyle={styles.codeScrollContent}
      >
        <View style={styles.codeLayout}>
          {/* Gutter con números de línea */}
          <View style={styles.gutter}>
            {lines.map((l) => (
              <Text key={`line-${l.lineNumber}`} style={styles.lineNumberText}>
                {l.lineNumber}
              </Text>
            ))}
          </View>

          {/* Bloque de texto fuente */}
          <View style={styles.codeLines}>
            {lines.map((l) => (
              <Text key={`code-${l.lineNumber}`} style={styles.codeText}>
                {l.content.length > 0 ? l.content : ' '}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
});

CodeViewer.displayName = 'CodeViewer';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#050814',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.22)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 195, 158, 0.15)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconContainer: {
    marginRight: 2,
  },
  languageLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#cbd5e1',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.3,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.30)',
  },
  copyButtonSuccess: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderColor: 'rgba(74, 222, 128, 0.40)',
  },
  btnIcon: {
    marginRight: 5,
  },
  copyButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  copyButtonSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ade80',
  },
  codeScrollView: {
    maxHeight: 380,
  },
  codeScrollContent: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  codeLayout: {
    flexDirection: 'row',
  },
  gutter: {
    paddingRight: 10,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'flex-end',
    userSelect: 'none',
  },
  lineNumberText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11.5,
    lineHeight: 18,
    color: '#475569',
    textAlign: 'right',
  },
  codeLines: {
    flexDirection: 'column',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11.5,
    lineHeight: 18,
    color: '#e2e8f0',
  },
});
