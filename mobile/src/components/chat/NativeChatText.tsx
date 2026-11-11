import React, { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Check } from 'lucide-react-native';
import { colors } from '../../theme/colors';

function inline(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return (
        <Text key={index} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <Text key={index} style={styles.inlineCode}>
          {part.slice(1, -1)}
        </Text>
      );
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
    if (link)
      return (
        <Text
          key={index}
          style={styles.link}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(link[2]).catch(() => {})}
        >
          {link[1]}
        </Text>
      );
    return part;
  });
}
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={styles.code}>
      <View style={styles.codeHeader}>
        <Text style={styles.language}>{language || 'Código'}</Text>
        <TouchableOpacity
          accessibilityLabel="Copiar código"
          onPress={() =>
            void Clipboard.setStringAsync(code)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch(() => {})
          }
        >
          {copied ? <Check size={13} color={colors.success} /> : <Copy size={13} color={colors.primary} />}
        </TouchableOpacity>
      </View>
      <ScrollView horizontal>
        <Text selectable style={styles.codeText}>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}
/** Text-only Markdown; HTML is plain text and no remote images are loaded. */
export function NativeChatText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let offset = 0;
  const paragraphs = (content: string) =>
    content.split('\n').forEach((line, index) => {
      if (!line.trim()) {
        blocks.push(<View key={`space-${blocks.length}`} style={styles.space} />);
        return;
      }
      const heading = /^#{1,6}\s+/.test(line),
        bullet = /^\s*[-*]\s+/.test(line);
      const value = heading
        ? line.replace(/^#{1,6}\s+/, '')
        : bullet
          ? line.replace(/^\s*[-*]\s+/, '• ')
          : line;
      blocks.push(
        <Text
          key={`text-${blocks.length}-${index}`}
          selectable
          style={[styles.text, heading && styles.heading]}
        >
          {inline(value)}
        </Text>
      );
    });
  for (const match of text.matchAll(/```([\w+-]*)\n([\s\S]*?)```/g)) {
    paragraphs(text.slice(offset, match.index));
    blocks.push(
      <CodeBlock key={`code-${match.index}`} language={match[1]} code={match[2].replace(/\n$/, '')} />
    );
    offset = match.index! + match[0].length;
  }
  paragraphs(text.slice(offset));
  return <View>{blocks}</View>;
}
const styles = StyleSheet.create({
  text: { color: colors.textSecondary, fontSize: 13, lineHeight: 21 },
  heading: { fontWeight: '700', color: colors.textPrimary, fontSize: 14, marginTop: 4 },
  bold: { fontWeight: '700', color: colors.textPrimary },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.primary,
    fontSize: 12,
  },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  space: { height: 5 },
  code: {
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.surfaceInput,
    overflow: 'hidden',
  },
  codeHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 9 },
  language: { color: colors.textMuted, fontSize: 10 },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 19,
    color: colors.textSecondary,
    padding: 10,
    paddingTop: 0,
  },
});
