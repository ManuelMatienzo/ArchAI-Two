import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Layers, MessageSquare } from 'lucide-react-native';
import { colors } from '../../theme/colors';

interface EmptyDiagramCardProps {
  onOpenChat: () => void;
}

/**
 * Estado elegante de lienzo vacío cuando una sala es nueva o no tiene clases.
 * Orienta al ingeniero en movilidad sin presentar una pantalla negra vacía.
 */
export const EmptyDiagramCard: React.FC<EmptyDiagramCardProps> = memo(({ onOpenChat }) => {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Layers size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>Espacio de Modelado Preparado</Text>
        <Text style={styles.description}>
          Esta sala no contiene clases modeladas aún. Las modificaciones que tu equipo realice desde el cliente Web se reflejarán aquí en tiempo real.
        </Text>

        <TouchableOpacity
          style={styles.chatButton}
          onPress={onOpenChat}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Abrir chat de la sala"
        >
          <MessageSquare size={15} color="#000020" style={styles.btnIcon} />
          <Text style={styles.chatBtnText}>Debatir en Chat de Sala</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

EmptyDiagramCard.displayName = 'EmptyDiagramCard';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: 'rgba(23, 26, 74, 0.92)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    maxWidth: 380,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(232, 195, 158, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 12.5,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnIcon: {
    marginRight: 8,
  },
  chatBtnText: {
    color: '#000020',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
