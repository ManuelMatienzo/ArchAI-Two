import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShieldAlert, RotateCcw } from 'lucide-react-native';
import { colors } from '../theme/colors';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Límite de errores de la aplicación.
 * Evita que un fallo de render en una pantalla cierre la app completa:
 * muestra un mensaje comercial neutro (sin detalles técnicos) y permite reintentar.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidMount() {
    const globalAny = globalThis as any;
    if (globalAny?.ErrorUtils?.setGlobalHandler) {
      const defaultHandler = globalAny.ErrorUtils.getGlobalHandler?.();
      globalAny.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        console.warn('[ArchAI Global Error Handled]', error?.message || error);
        if (!isFatal && defaultHandler) {
          defaultHandler(error, isFatal);
        }
      });
    }
  }

  componentDidCatch(error: Error) {
    // Registro interno para diagnóstico; nunca se muestra al cliente final.
    console.warn('[ArchAI] Error de interfaz contenido:', error?.message);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <ShieldAlert size={30} color={colors.primary} />
          </View>

          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.description}>
            No pudimos cargar esta pantalla. Vuelve a intentarlo.
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
          >
            <RotateCcw size={15} color={colors.textOnPrimary} style={styles.retryIcon} />
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
});
