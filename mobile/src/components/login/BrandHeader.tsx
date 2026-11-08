import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Boxes, Sparkles } from 'lucide-react-native';
import { colors } from '../../theme/colors';

/**
 * Cabecera de marca del login móvil.
 * Composición vertical propia del teléfono: lockup horizontal + titular corto,
 * en lugar del bloque centrado de la versión web.
 */
interface BrandHeaderProps {
  /** Reduce la cabecera en pantallas bajas para que el CTA quede visible. */
  compact?: boolean;
}

export const BrandHeader: React.FC<BrandHeaderProps> = memo(({ compact = false }) => {
  return (
    <View style={styles.container}>
      <View style={styles.lockup}>
        <View style={[styles.logoBadge, compact && styles.logoBadgeCompact]}>
          <View style={styles.logoInner}>
            <Boxes size={compact ? 18 : 20} color={colors.primary} />
          </View>
        </View>

        <View style={styles.lockupText}>
          <Text style={styles.brandTitle}>ArchAI</Text>
          <View style={styles.brandTagRow}>
            <Sparkles size={9} color={colors.primary} />
            <Text style={styles.brandTag}>ESTUDIO UML & IA</Text>
          </View>
        </View>
      </View>

      <View style={[styles.accentLine, compact && styles.accentLineCompact]} />

      <Text style={[styles.headline, compact && styles.headlineCompact]}>
        Tu arquitectura,{'\n'}
        <Text style={styles.headlineAccent}>en movimiento.</Text>
      </Text>

      {!compact && (
        <Text style={styles.subtitle}>
          Supervisa el lienzo, el chat y las propuestas de la IA desde tu celular.
        </Text>
      )}
    </View>
  );
});
BrandHeader.displayName = 'BrandHeader';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(23, 26, 74, 0.85)',
    borderWidth: 1.2,
    borderColor: 'rgba(232, 195, 158, 0.45)',
    padding: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  logoInner: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232, 195, 158, 0.22)',
    backgroundColor: 'rgba(0, 0, 32, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeCompact: {
    width: 42,
    height: 42,
    borderRadius: 13,
  },
  lockupText: {
    flex: 1,
  },
  brandTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  brandTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  brandTag: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  accentLine: {
    width: 34,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.primary,
    opacity: 0.85,
    marginTop: 22,
    marginBottom: 14,
  },
  accentLineCompact: {
    marginTop: 16,
    marginBottom: 10,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  headlineCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
  headlineAccent: {
    color: colors.primary,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 10,
    maxWidth: 300,
  },
});
