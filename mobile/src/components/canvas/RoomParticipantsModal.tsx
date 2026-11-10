import React, { useState, memo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  Users,
  X,
  Copy,
  Check,
  Shield,
  Share2,
  Laptop,
  Smartphone,
  Sparkles,
} from 'lucide-react-native';
import { RoomParticipant } from '../../api/roomsApi';
import { colors } from '../../theme/colors';

interface RoomParticipantsModalProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  participants: RoomParticipant[];
  currentUserId?: string;
}

/**
 * Determina el tipo de cliente para mostrar el icono adecuado.
 */
function resolveClientType(p: RoomParticipant): 'MOBILE' | 'AI' | 'WEB' {
  if (p.clientType === 'AI_SERVICE' || p.name?.toLowerCase().includes('archai') || p.role?.toLowerCase().includes('ia')) {
    return 'AI';
  }
  if (p.clientType === 'MOBILE_APP' || p.role?.toLowerCase().includes('móvil') || p.role?.toLowerCase().includes('movil')) {
    return 'MOBILE';
  }
  return 'WEB';
}

/**
 * Modal Glassmorphic de Participantes Activos en Sala (Fase 3 - Hub de Salas).
 * Permite al supervisor en Modo Viaje auditar colaboradores conectados, roles y dispositivos.
 */
export const RoomParticipantsModal: React.FC<RoomParticipantsModalProps> = memo(({
  visible,
  onClose,
  roomId,
  roomName,
  participants,
  currentUserId = 'usr-mobile-01',
}) => {
  const [copied, setCopied] = useState(false);

  // Copiado rápido de PIN
  const handleCopyPin = async () => {
    try {
      await Clipboard.setStringAsync(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Compartir invitación nativa (WhatsApp, Slack, Teams, Email, etc.)
  const handleShareInvite = async () => {
    try {
      await Share.share({
        title: `Invitación a Sala de Arquitectura ArchAI: ${roomName}`,
        message: `¡Únete a la sesión de diseño arquitectónico en ArchAI Studio!\n\nSala: ${roomName}\nCódigo PIN: ${roomId}\nAcceso: Conéctate desde la Web o en la App Móvil usando este PIN.`,
      });
    } catch {}
  };

  // Asegurar que la lista incluya al asistente @ArchAI si no está listado explícitamente
  const displayParticipants: RoomParticipant[] = React.useMemo(() => {
    const list = [...participants];
    const hasAi = list.some((p) => p.name?.toLowerCase().includes('archai'));
    if (!hasAi) {
      list.push({
        id: 'ai-archai-assistant',
        name: 'ArchAI Co-Developer',
        role: 'Asistente IA (3FN & JPA)',
        avatarColor: '#2f2c79',
        clientType: 'AI_SERVICE',
        connectedSince: 'En línea',
      });
    }
    return list;
  }, [participants]);

  // Desglose de dispositivos conectados en tiempo real
  const deviceStats = React.useMemo(() => {
    let web = 0;
    let mobile = 0;
    let ai = 0;
    displayParticipants.forEach((p) => {
      const type = resolveClientType(p);
      if (type === 'AI') ai++;
      else if (type === 'MOBILE') mobile++;
      else web++;
    });
    return { web, mobile, ai };
  }, [displayParticipants]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Users size={16} color={colors.primary} />
              </View>
              <View style={styles.headerTexts}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.title}>Colaboradores en Sala</Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{displayParticipants.length}</Text>
                  </View>
                </View>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {roomName} · {roomId}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Cerrar modal">
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Desglose de Plataformas Conectadas */}
          <View style={styles.deviceStatsRow}>
            {deviceStats.web > 0 && (
              <View style={styles.deviceStatBadge}>
                <Laptop size={11} color="#38bdf8" style={{ marginRight: 4 }} />
                <Text style={[styles.deviceStatText, { color: '#38bdf8' }]}>
                  {deviceStats.web} Web Studio
                </Text>
              </View>
            )}

            {deviceStats.mobile > 0 && (
              <View style={styles.deviceStatBadge}>
                <Smartphone size={11} color="#4ade80" style={{ marginRight: 4 }} />
                <Text style={[styles.deviceStatText, { color: '#4ade80' }]}>
                  {deviceStats.mobile} Móvil
                </Text>
              </View>
            )}

            {deviceStats.ai > 0 && (
              <View style={styles.deviceStatBadge}>
                <Sparkles size={11} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.deviceStatText, { color: colors.primary }]}>
                  {deviceStats.ai} Copiloto
                </Text>
              </View>
            )}
          </View>

          {/* Lista de Participantes */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {displayParticipants.map((p, idx) => {
              const clientType = resolveClientType(p);
              const isCurrent = p.isCurrentUser || p.id === currentUserId;

              return (
                <View key={p.id || `p-${idx}`} style={styles.participantItem}>
                  {/* Avatar con inicial o isotipo IA */}
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: p.avatarColor || (clientType === 'AI' ? 'rgba(47, 44, 121, 0.65)' : 'rgba(232, 195, 158, 0.18)') },
                      clientType === 'AI' && styles.avatarAi,
                    ]}
                  >
                    {clientType === 'AI' ? (
                      <Sparkles size={16} color={colors.primary} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {(p.name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>

                  {/* Datos del Participante y Badges */}
                  <View style={styles.itemInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.participantName} numberOfLines={1}>
                        {p.name}
                      </Text>

                      {isCurrent && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>Tú</Text>
                        </View>
                      )}

                      {p.isHost && (
                        <View style={styles.hostBadge}>
                          <Shield size={9} color="#fbbf24" style={{ marginRight: 2 }} />
                          <Text style={styles.hostBadgeText}>Anfitrión</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.roleRow}>
                      <Text style={styles.participantRole} numberOfLines={1}>
                        {p.role || 'Ingeniero de Software'}
                        <Text style={styles.connectedSinceText}>
                          {p.connectedSince ? ` · ${p.connectedSince}` : ' · En línea'}
                        </Text>
                      </Text>

                      {/* Indicador de Tipo de Cliente */}
                      <View style={styles.clientTag}>
                        {clientType === 'MOBILE' ? (
                          <>
                            <Smartphone size={10} color="#4ade80" style={{ marginRight: 3 }} />
                            <Text style={[styles.clientTagText, { color: '#4ade80' }]}>Móvil</Text>
                          </>
                        ) : clientType === 'AI' ? (
                          <>
                            <Sparkles size={10} color={colors.primary} style={{ marginRight: 3 }} />
                            <Text style={[styles.clientTagText, { color: colors.primary }]}>Copiloto</Text>
                          </>
                        ) : (
                          <>
                            <Laptop size={10} color="#38bdf8" style={{ marginRight: 3 }} />
                            <Text style={[styles.clientTagText, { color: '#38bdf8' }]}>Web Studio</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Botones de Acción (Compartir Enlace + Copiar PIN) */}
          <View style={styles.actionBtnRow}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShareInvite}
              activeOpacity={0.8}
            >
              <Share2 size={13} color={colors.primary} style={{ marginRight: 5 }} />
              <Text style={styles.shareBtnText}>Compartir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
              onPress={handleCopyPin}
              activeOpacity={0.8}
            >
              {copied ? (
                <>
                  <Check size={13} color="#000020" style={{ marginRight: 5 }} />
                  <Text style={styles.copyBtnText}>¡Copiado!</Text>
                </>
              ) : (
                <>
                  <Copy size={13} color="#000020" style={{ marginRight: 5 }} />
                  <Text style={styles.copyBtnText}>Copiar PIN</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

RoomParticipantsModal.displayName = 'RoomParticipantsModal';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 16, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 195, 158, 0.28)',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
    maxHeight: '78%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 195, 158, 0.14)',
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.30)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTexts: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  countPill: {
    backgroundColor: 'rgba(232, 195, 158, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countPillText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  deviceStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  deviceStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  deviceStatText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  connectedSinceText: {
    fontSize: 9.5,
    color: colors.textMuted,
    fontWeight: '400',
  },
  list: {
    marginTop: 10,
    marginBottom: 14,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.25)',
  },
  avatarAi: {
    borderColor: colors.primary,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  itemInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  participantName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    flexShrink: 1,
  },
  youBadge: {
    backgroundColor: 'rgba(232, 195, 158, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(232, 195, 158, 0.35)',
  },
  youBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.primary,
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 0.5,
    borderColor: '#fbbf24',
  },
  hostBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#fbbf24',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  participantRole: {
    fontSize: 10.5,
    color: colors.textSecondary,
    flex: 1,
    marginRight: 6,
  },
  clientTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  clientTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    borderRadius: 10,
    paddingVertical: 10,
  },
  shareBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
  },
  copyBtnSuccess: {
    backgroundColor: '#4ade80',
  },
  copyBtnText: {
    color: '#000020',
    fontSize: 12,
    fontWeight: '800',
  },
});
