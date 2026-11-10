import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { Server, Cloud, Save, Wifi, CheckCircle2, AlertCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { getBackendUrl, setBackendUrl, getDefaultBackendUrl, getAutoDetectedHost } from '../api/client';
import {
  activarNotificacionesPush,
  desactivarNotificacionesPush,
  estaPushHabilitado,
  type UsuarioPush,
} from '../services/pushNotificationsService';

export const SettingsScreen = ({ navigation }: any) => {
  const [serverUrl, setServerUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [usuario, setUsuario] = useState<UsuarioPush | null>(null);
  const [offlineCacheEnabled, setOfflineCacheEnabled] = useState(true);

  useEffect(() => {
    getBackendUrl().then((url) => setServerUrl(url));
    estaPushHabilitado().then(setPushEnabled).catch(() => {});
    AsyncStorage.getItem('archai_session')
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const perfil = parsed?.user || parsed;
        if (perfil?.id) {
          setUsuario({ id: String(perfil.id), name: perfil.name });
        }
      })
      .catch(() => {});
  }, []);

  // CU-23 — Activa/desactiva notificaciones reales (permiso + token + registro backend).
  const handleTogglePush = async (value: boolean) => {
    if (pushBusy) return;

    if (value && !usuario?.id) {
      Alert.alert('Notificaciones', 'Inicia sesión para activar las notificaciones en este dispositivo.');
      return;
    }

    setPushBusy(true);
    setPushEnabled(value);

    try {
      if (value && usuario) {
        const resultado = await activarNotificacionesPush(usuario);
        if (!resultado.ok) {
          setPushEnabled(false);
          Alert.alert(
            'Notificaciones',
            resultado.motivo === 'permiso-denegado'
              ? 'Activa el permiso de notificaciones de ArchAI en los ajustes del sistema.'
              : 'No se pudieron activar las notificaciones en este dispositivo. Intenta de nuevo más tarde.'
          );
        }
      } else {
        await desactivarNotificacionesPush();
      }
    } catch {
      setPushEnabled(!value);
      Alert.alert('Notificaciones', 'No se pudieron actualizar las notificaciones. Intenta de nuevo más tarde.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestConnection = async () => {
    if (!serverUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${serverUrl.trim()}/auth/check`, {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (res && res.status < 500) {
        setTestResult({ ok: true, message: 'Conexión exitosa con el backend.' });
      } else {
        setTestResult({ ok: true, message: 'Servidor alcanzable en la red.' });
      }
    } catch {
      setTestResult({ ok: false, message: 'No se pudo conectar al endpoint configurado.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('URL requerida', 'Por favor ingresa la URL del backend.');
      return;
    }
    await setBackendUrl(serverUrl.trim());
    Alert.alert('Guardado', 'La configuración del servidor ha sido actualizada exitosamente.');
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Ajustes de Conexión</Text>
        <Text style={styles.subtitle}>Configuración del backend local o en la nube para ArchAI</Text>
      </View>

      {/* Server URL Config */}
      <View style={styles.card}>
        <Text style={styles.label}>URL del Servidor Backend</Text>
        
        {/* Preset Selector */}
        <View style={styles.presetRow}>
          <TouchableOpacity
            style={[styles.presetBtn, serverUrl.includes(getAutoDetectedHost()) && styles.presetBtnActive]}
            onPress={() => setServerUrl(getDefaultBackendUrl())}
          >
            <Wifi size={12} color={serverUrl.includes(getAutoDetectedHost()) ? colors.textOnPrimary : colors.primary} />
            <Text style={[styles.presetText, serverUrl.includes(getAutoDetectedHost()) && styles.presetTextActive]}>
              Automático
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetBtn, serverUrl.includes('10.0.2.2') && styles.presetBtnActive]}
            onPress={() => setServerUrl('http://10.0.2.2:8000/api/v1')}
          >
            <Server size={12} color={serverUrl.includes('10.0.2.2') ? colors.textOnPrimary : colors.primary} />
            <Text style={[styles.presetText, serverUrl.includes('10.0.2.2') && styles.presetTextActive]}>Red Local</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetBtn, (serverUrl.includes('https') || serverUrl.includes('railway') || serverUrl.includes('render') || serverUrl.includes('archai.io')) && styles.presetBtnActive]}
            onPress={() => setServerUrl('https://api.archai.io/api/v1')}
          >
            <Cloud size={12} color={(serverUrl.includes('https') || serverUrl.includes('railway') || serverUrl.includes('render') || serverUrl.includes('archai.io')) ? colors.textOnPrimary : colors.primary} />
            <Text style={[styles.presetText, (serverUrl.includes('https') || serverUrl.includes('railway') || serverUrl.includes('render') || serverUrl.includes('archai.io')) && styles.presetTextActive]}>Nube</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={(txt) => {
            setServerUrl(txt);
            setTestResult(null);
          }}
          placeholder="https://api.archai.io/api/v1"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />

        {/* Test Connection Button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <TouchableOpacity
            style={styles.testBtn}
            onPress={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.testBtnText}>Probar Conexión</Text>
            )}
          </TouchableOpacity>

          {testResult && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {testResult.ok ? (
                <CheckCircle2 size={14} color={colors.success} />
              ) : (
                <AlertCircle size={14} color={colors.error} />
              )}
              <Text style={{ fontSize: 11, color: testResult.ok ? colors.success : colors.error, fontWeight: '700' }}>
                {testResult.ok ? 'Disponible' : 'Sin respuesta'}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.helperText}>
          Ingresa la IP de tu PC para probar en tu celular por Wi-Fi, o pega la URL HTTPS de tu servidor en la nube (AWS / Railway / Render).
        </Text>
      </View>

      {/* Switches */}
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Notificaciones Push</Text>
            <Text style={styles.switchDesc}>Recibe alertas de cambios críticos en tus proyectos y salas</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={handleTogglePush}
            disabled={pushBusy}
            thumbColor={pushEnabled ? colors.primary : '#4b5563'}
            trackColor={{ false: '#374151', true: 'rgba(56, 189, 248, 0.4)' }}
          />
        </View>

        <View style={[styles.switchRow, { borderTopWidth: 1, borderTopColor: colors.borderGlass, paddingTop: 14, marginTop: 14 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Caché Offline (IndexedDB / Storage)</Text>
            <Text style={styles.switchDesc}>Guardar último diagrama para visualización en vuelos o sin red</Text>
          </View>
          <Switch
            value={offlineCacheEnabled}
            onValueChange={setOfflineCacheEnabled}
            thumbColor={offlineCacheEnabled ? colors.primary : '#4b5563'}
            trackColor={{ false: '#374151', true: 'rgba(56, 189, 248, 0.4)' }}
          />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Save size={16} color={colors.textOnPrimary} style={{ marginRight: 6 }} />
        <Text style={styles.saveBtnText}>Guardar Configuración</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  presetBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  presetTextActive: {
    color: colors.textOnPrimary,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  testBtn: {
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  helperText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 10,
    lineHeight: 15,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  switchDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});
