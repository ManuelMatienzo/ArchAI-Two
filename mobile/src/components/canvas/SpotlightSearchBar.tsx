import React, { memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { UmlClass } from '../../types/uml';
import { colors } from '../../theme/colors';

interface SpotlightSearchBarProps {
  isOpen: boolean;
  query: string;
  onChangeQuery: (text: string) => void;
  onClear: () => void;
  results: UmlClass[];
  onSelectClass: (targetClass: UmlClass) => void;
}

export const SpotlightSearchBar: React.FC<SpotlightSearchBarProps> = memo(({
  isOpen,
  query,
  onChangeQuery,
  onClear,
  results,
  onSelectClass,
}) => {
  if (!isOpen) return null;

  const hasQuery = query.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Campo de búsqueda con autofoco */}
      <View style={styles.inputRow}>
        <Search size={15} color={colors.primary} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Localizar clase (ej. DetalleVenta)..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={onChangeQuery}
          autoFocus={true}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {hasQuery && (
          <TouchableOpacity
            onPress={onClear}
            style={styles.clearBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Limpiar búsqueda"
          >
            <X size={15} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Lista de Resultados de Búsqueda */}
      {hasQuery && results.length > 0 && (
        <ScrollView style={styles.resultsList} keyboardShouldPersistTaps="handled">
          {results.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.resultItem}
              onPress={() => onSelectClass(item)}
              activeOpacity={0.7}
            >
              <View style={styles.itemLeft}>
                <Text style={styles.stereotype}>
                  «{item.stereotype || 'Entity'}»
                </Text>
                <Text style={styles.className}>{item.name}</Text>
                {item.tableName && (
                  <Text style={styles.tableName}>({item.tableName})</Text>
                )}
              </View>
              <Text style={styles.meta}>
                {item.attributes.length} attrs · {item.methods.length} met
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Estado vacío cuando no hay coincidencias */}
      {hasQuery && results.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No se encontraron clases que coincidan con "{query}"
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 195, 158, 0.30)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 25,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(23, 26, 74, 0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    color: '#ffffff',
    paddingVertical: 4,
  },
  clearBtn: {
    padding: 4,
  },
  resultsList: {
    marginTop: 8,
    maxHeight: 180,
    backgroundColor: 'rgba(23, 26, 74, 0.95)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.20)',
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  stereotype: {
    fontSize: 11,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  className: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  tableName: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  meta: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyContainer: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(23, 26, 74, 0.85)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.20)',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
