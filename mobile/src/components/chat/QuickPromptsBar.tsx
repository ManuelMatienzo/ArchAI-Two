import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Search, Layers, ShieldCheck, Sparkles } from 'lucide-react-native';
import { colors } from '../../theme/colors';

export interface QuickPromptItem {
  id: string;
  label: string;
  prompt: string;
  iconType: '3fn' | 'summary' | 'keys' | 'arch';
}

export const DEFAULT_QUICK_PROMPTS: QuickPromptItem[] = [
  {
    id: '3fn',
    label: 'Auditar 3FN',
    prompt: '@ArchAI ¿El modelo actual cumple con la 3FN?',
    iconType: '3fn',
  },
  {
    id: 'summary',
    label: 'Resumen de Clases',
    prompt: '@ArchAI Genera un resumen arquitectónico de las clases y relaciones.',
    iconType: 'summary',
  },
  {
    id: 'keys',
    label: 'Revisar PK / FK',
    prompt: '@ArchAI Revisa las claves primarias y foráneas de la arquitectura.',
    iconType: 'keys',
  },
  {
    id: 'arch',
    label: 'Explicar Arquitectura',
    prompt: '@ArchAI Explica el flujo de datos principal de este diseño.',
    iconType: 'arch',
  },
];

interface QuickPromptsBarProps {
  prompts?: QuickPromptItem[];
  onSelectPrompt: (prompt: string) => void;
  onLongPressPrompt?: (prompt: string) => void;
}

export const QuickPromptsBar: React.FC<QuickPromptsBarProps> = memo(({
  prompts = DEFAULT_QUICK_PROMPTS,
  onSelectPrompt,
  onLongPressPrompt,
}) => {
  const renderIcon = (type: string) => {
    switch (type) {
      case '3fn':
        return <Search size={11} color={colors.primary} style={styles.chipIcon} />;
      case 'summary':
        return <Layers size={11} color={colors.primary} style={styles.chipIcon} />;
      case 'keys':
        return <ShieldCheck size={11} color={colors.primary} style={styles.chipIcon} />;
      case 'arch':
      default:
        return <Sparkles size={11} color={colors.primary} style={styles.chipIcon} />;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {prompts.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.chip}
            onPress={() => onSelectPrompt(item.prompt)}
            onLongPress={() => onLongPressPrompt?.(item.prompt)}
            activeOpacity={0.7}
            accessibilityLabel={`Enviar consulta: ${item.label}`}
          >
            {renderIcon(item.iconType)}
            <Text style={styles.chipText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 9,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(23, 26, 74, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipIcon: {
    marginRight: 5,
  },
  chipText: {
    color: colors.primary,
    fontSize: 11.5,
    fontWeight: '700',
  },
});
