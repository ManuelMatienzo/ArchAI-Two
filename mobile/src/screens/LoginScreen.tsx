import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  AlertCircle,
  ArrowRight,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { LoginBackground } from '../components/LoginBackground';
import { BrandHeader } from '../components/login/BrandHeader';
import { AuthModeSwitch, type AuthMode } from '../components/login/AuthModeSwitch';
import { QuickProfileSelector } from '../components/login/QuickProfileSelector';
import { CustomInput } from '../components/common/CustomInput';
import { CustomButton } from '../components/common/CustomButton';
import { authApi } from '../api/authApi';
import { QuickProfile } from '../types/auth';

export type ModeType = AuthMode;

const ENTER_HERO = { duration: 420, easing: Easing.out(Easing.cubic) };
const ENTER_SHEET = { duration: 500, easing: Easing.out(Easing.cubic) };

export const LoginScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < 760;

  const [modo, setModo] = useState<ModeType>('login');
  const [name, setName] = useState('Ing. Carlos Criado');
  const [email, setEmail] = useState('carlos.criado@archai.io');
  const [password, setPassword] = useState('password123');
  const [role, setRole] = useState('Arquitecto de Software');
  const [loading, setLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');

  // Entrada del panel y de la cabecera (hilo de UI, sin re-renders).
  const heroProgress = useSharedValue(reduceMotion ? 1 : 0);
  const sheetProgress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      heroProgress.value = 1;
      sheetProgress.value = 1;
      return;
    }
    heroProgress.value = withTiming(1, ENTER_HERO);
    sheetProgress.value = withDelay(90, withTiming(1, ENTER_SHEET));
  }, [heroProgress, reduceMotion, sheetProgress]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroProgress.value,
    transform: [{ translateY: (1 - heroProgress.value) * 14 }],
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetProgress.value,
    transform: [{ translateY: (1 - sheetProgress.value) * 60 }],
  }));

  const handleSelectProfile = useCallback((profile: QuickProfile) => {
    setName(profile.name);
    setEmail(profile.email);
    setRole(profile.role);
    setPassword('password123');
    setErrorLocal('');
  }, []);

  const handleModeChange = useCallback((next: ModeType) => {
    setModo(next);
    setErrorLocal('');
  }, []);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setErrorLocal('Por favor ingresa tu correo electrónico.');
      return;
    }
    if (!password.trim()) {
      setErrorLocal('Por favor ingresa tu contraseña.');
      return;
    }
    if (modo === 'registro' && !name.trim()) {
      setErrorLocal('Por favor ingresa tu nombre completo.');
      return;
    }

    setErrorLocal('');
    setLoading(true);

    try {
      if (modo === 'registro') {
        await authApi.register(name, email, password, role);
      }

      // Autenticación (con soporte nativo para Backend Local y Backend Nube)
      const session = await authApi.login(email, password);

      // Persistencia local para navegación en el software
      await AsyncStorage.setItem('archai_session', JSON.stringify(session));

      // Ingresa directamente al Gestor de Salas y Lienzo
      navigation.replace('Rooms');
    } catch (err: any) {
      setErrorLocal(
        err?.message ||
          'No se pudo iniciar la sesión. Revisa tus credenciales e intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LoginBackground />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Cabecera de marca (zona superior libre) */}
          <Animated.View
            style={[styles.hero, compact && styles.heroCompact, heroStyle]}
          >
            <BrandHeader compact={compact} />
          </Animated.View>

          {/* Panel inferior del formulario */}
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 18 },
              sheetStyle,
            ]}
          >
            <View style={styles.grabber} />

            <AuthModeSwitch mode={modo} onChange={handleModeChange} />

            <QuickProfileSelector
              selectedEmail={email}
              onSelect={handleSelectProfile}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>O USA TUS CREDENCIALES</Text>
              <View style={styles.dividerLine} />
            </View>

            {errorLocal ? (
              <View style={styles.errorBox}>
                <AlertCircle size={14} color={colors.error} />
                <Text style={styles.errorText}>{errorLocal}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              {modo === 'registro' && (
                <CustomInput
                  label="Nombre completo"
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej. Ing. Carlos Criado"
                  icon={<User size={15} color={colors.primary} />}
                  autoCapitalize="words"
                  textContentType="name"
                />
              )}

              <CustomInput
                label="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                placeholder="usuario@archai.io"
                icon={<Mail size={15} color={colors.primary} />}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
              />

              <CustomInput
                label="Contraseña de acceso"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                icon={<Lock size={15} color={colors.primary} />}
                isPassword
                textContentType="password"
              />

              <CustomButton
                title={modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                variant="primary"
                loading={loading}
                icon={<ArrowRight size={17} color={colors.textOnPrimary} />}
                onPress={handleSubmit}
                style={styles.submitBtn}
              />
            </View>

            <TouchableOpacity
              style={styles.switchModeBtn}
              onPress={() =>
                handleModeChange(modo === 'login' ? 'registro' : 'login')
              }
              activeOpacity={0.7}
            >
              <Text style={styles.switchModeText}>
                {modo === 'login'
                  ? '¿Aún no tienes cuenta? Regístrate'
                  : '¿Ya tienes cuenta? Inicia sesión'}
              </Text>
            </TouchableOpacity>

            <View style={styles.secureRow}>
              <ShieldCheck size={12} color={colors.textMuted} />
              <Text style={styles.secureText}>
                Conexión segura · Supervisión en tiempo real
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  hero: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 30,
  },
  heroCompact: {
    paddingTop: 2,
    paddingBottom: 18,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: 'rgba(13, 15, 44, 0.94)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1.2,
    borderColor: 'rgba(232, 195, 158, 0.20)',
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 18,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(232, 195, 158, 0.35)',
    marginBottom: 14,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(232, 195, 158, 0.16)',
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 15,
  },
  form: {
    gap: 13,
  },
  submitBtn: {
    marginTop: 5,
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchModeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
  secureText: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
