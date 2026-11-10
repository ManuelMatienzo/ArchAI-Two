import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Folder, ChevronRight, User, KeyRound, Layers } from 'lucide-react-native';
import { ProjectItem } from '../../api/roomsApi';
import { colors } from '../../theme/colors';

export interface ProjectCardItemProps {
  project: ProjectItem;
  currentUserId: string;
  onSelect: (project: ProjectItem) => void;
}

/**
 * Tarjeta individual de Proyecto en el Hub Móvil (CU-02).
 * Muestra metadatos clave, badge de código de acceso y distinción clara de propietario.
 */
export const ProjectCardItem: React.FC<ProjectCardItemProps> = memo(({
  project,
  currentUserId,
  onSelect,
}) => {
  const isOwner = project.propietarioId === currentUserId;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onSelect(project)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Proyecto ${project.nombre}, código ${project.codigoAcceso}`}
    >
      <View style={styles.cardLeft}>
        <View style={styles.headerRow}>
          <View style={styles.codeBadge}>
            <KeyRound size={11} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.codeText}>{project.codigoAcceso}</Text>
          </View>

          <View style={[styles.ownerBadge, isOwner ? styles.ownerBadgeSelf : styles.ownerBadgeOther]}>
            <User size={10} color={isOwner ? colors.primary : '#a5b4fc'} style={{ marginRight: 3 }} />
            <Text style={[styles.ownerText, isOwner ? styles.ownerTextSelf : styles.ownerTextOther]}>
              {isOwner ? 'Tú (Propietario)' : project.propietarioNombre || 'Colaborador'}
            </Text>
          </View>
        </View>

        <Text style={styles.projectName} numberOfLines={1}>
          {project.nombre}
        </Text>

        {project.descripcion ? (
          <Text style={styles.description} numberOfLines={2}>
            {project.descripcion}
          </Text>
        ) : null}

        <View style={styles.footerRow}>
          <View style={styles.diagramCountPill}>
            <Layers size={11} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.diagramCountText}>
              {project.totalDiagramas === 1 ? '1 Diagrama' : `${project.totalDiagramas || 0} Diagramas`}
            </Text>
          </View>
          <Text style={styles.stateText}>Modo Viaje · Lectura</Text>
        </View>
      </View>

      <ChevronRight size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
});

ProjectCardItem.displayName = 'ProjectCardItem';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  codeText: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  ownerBadgeSelf: {
    backgroundColor: 'rgba(232, 195, 158, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
  },
  ownerBadgeOther: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.30)',
  },
  ownerText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ownerTextSelf: {
    color: colors.primary,
  },
  ownerTextOther: {
    color: '#a5b4fc',
  },
  projectName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  diagramCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diagramCountText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 10.5,
  },
});
