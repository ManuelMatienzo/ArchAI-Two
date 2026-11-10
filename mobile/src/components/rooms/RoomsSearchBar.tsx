import React, { memo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors } from '../../theme/colors';

export interface RoomsSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

/**
 * Buscador reactivo en tiempo real para filtrar salas por código PIN, nombre o proyecto.
 * Componente modular desacoplado (Fase 4 - Hub de Salas).
 */
export const RoomsSearchBar: React.FC<RoomsSearchBarProps> = memo(({
  value,
  onChangeText,
  onClear,
  placeholder = 'Filtrar por nombre o PIN...',
}) => {
  return (
    <View style={styles.searchRow}>
      <Search size={14} color={colors.primary} style={{ marginRight: 8 }} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={onClear ? onClear : () => onChangeText('')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Limpiar búsqueda"
          style={styles.clearBtn}
        >
          <X size={13} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
});

RoomsSearchBar.displayName = 'RoomsSearchBar';

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
    marginLeft: 6,
  },
});
