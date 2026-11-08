import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Users,
  Plus,
  Laptop,
  ArrowRight,
  ChevronRight,
  Activity,
  LogOut,
  Radio,
  User as UserIcon,
} from 'lucide-react-native';
import { colors } from '../theme/colors';

interface RoomItem {
  id: string;
  name: string;
  projectCode: string;
  activeUsers: number;
  lastUpdated: string;
}

export const RoomsScreen = ({ navigation }: any) => {
  const [userName, setUserName] = useState('Ing. Carlos Criado');
  const [userRole, setUserRole] = useState('Arquitecto de Software');
  const [roomCode, setRoomCode] = useState('');
  const [newRoomModalVisible, setNewRoomModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('Sesión de Ingeniería UML');

  const [rooms, setRooms] = useState<RoomItem[]>([
    {
      id: 'ARC-GRUPO04',
      name: 'Sesión Examen CASE - Grupo 04',
      projectCode: 'PRJ-881920',
      activeUsers: 3,
      lastUpdated: 'Hace 2 min (Co-Diseño IA Activo)',
    },
    {
      id: 'ARC-2041',
      name: 'Microservicio de Inventario y Catálogo',
      projectCode: 'PRJ-104928',
      activeUsers: 1,
      lastUpdated: 'Hace 15 min',
    },
  ]);

  useEffect(() => {
    AsyncStorage.getItem('archai_session').then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.user?.name) setUserName(parsed.user.name);
          if (parsed?.user?.role) setUserRole(parsed.user.role);
        } catch {}
      }
    });
  }, []);

  const handleJoinByCode = () => {
    if (!roomCode.trim()) return;
    const cleanPin = roomCode.trim().toUpperCase();
    const finalPin = cleanPin.startsWith('ARC-') ? cleanPin : `ARC-${cleanPin}`;
    navigation.navigate('CanvasViewer', { roomId: finalPin, roomName: `Sala ${finalPin}` });
  };

  const handleSelectRoom = (room: RoomItem) => {
    navigation.navigate('CanvasViewer', { roomId: room.id, roomName: room.name });
  };

  const handleCreateHostRoom = () => {
    const generatedPin = 'ARC-' + Math.floor(100000 + Math.random() * 900000);
    const newRoom: RoomItem = {
      id: generatedPin,
      name: newRoomName.trim() || 'Nueva Sala de Arquitectura',
      projectCode: 'PRJ-' + Math.floor(100000 + Math.random() * 900000),
      activeUsers: 1,
      lastUpdated: 'Creada ahora mismo',
    };
    setRooms([newRoom, ...rooms]);
    setNewRoomModalVisible(false);
    navigation.navigate('CanvasViewer', { roomId: generatedPin, roomName: newRoom.name });
  };

  const handleEnterLocalMode = () => {
    navigation.navigate('CanvasViewer', {
      roomId: 'LOCAL-MODE',
      roomName: 'Espacio Individual de Modelado',
    });
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('archai_session');
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      {/* Barra de Perfil Logueado */}
      <View style={styles.userBar}>
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <UserIcon size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.userNameText}>{userName}</Text>
            <Text style={styles.userRoleText}>{userRole}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Acciones Principales (Unirse | Crear | Modo Local) */}
      <View style={styles.actionsContainer}>
        {/* Unirse por Código */}
        <View style={styles.joinBox}>
          <Text style={styles.sectionLabel}>UNIRSE A SALA COLABORATIVA</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.codeInput}
              value={roomCode}
              onChangeText={setRoomCode}
              placeholder="Código PIN (ej. ARC-GRUPO04)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.joinActionBtn} onPress={handleJoinByCode}>
              <ArrowRight size={16} color={colors.textOnPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Botones de Crear Sala / Modo Local */}
        <View style={styles.quickActionRow}>
          <TouchableOpacity
            style={styles.hostActionBtn}
            onPress={() => setNewRoomModalVisible(true)}
          >
            <Plus size={16} color={colors.primary} />
            <Text style={styles.hostActionBtnText}>Crear Sala (Anfitrión)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.soloActionBtn}
            onPress={handleEnterLocalMode}
          >
            <Laptop size={16} color={colors.textSecondary} />
            <Text style={styles.soloActionBtnText}>Modo Personal</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Salas Activas */}
      <View style={styles.listHeaderRow}>
        <Radio size={14} color={colors.primary} />
        <Text style={styles.listSectionTitle}>Salas Activas Disponibles</Text>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.roomCard} onPress={() => handleSelectRoom(item)}>
            <View style={styles.roomCardLeft}>
              <View style={styles.roomHeader}>
                <View style={styles.roomIdBadge}>
                  <Text style={styles.roomIdText}>{item.id}</Text>
                </View>
                <View style={styles.liveIndicator}>
                  <Activity size={12} color={colors.success} />
                  <Text style={styles.activeUsers}>{item.activeUsers} en sala</Text>
                </View>
              </View>

              <Text style={styles.roomName}>{item.name}</Text>
              <Text style={styles.projectCode}>Proyecto: {item.projectCode}</Text>
              <Text style={styles.lastUpdated}>{item.lastUpdated}</Text>
            </View>

            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />

      {/* Modal Crear Sala Nueva */}
      <Modal
        visible={newRoomModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewRoomModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setNewRoomModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear Sala Colaborativa</Text>
            <Text style={styles.modalSubtitle}>
              Como anfitrión podrás invitar colaboradores con el PIN generado.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={newRoomName}
              onChangeText={setNewRoomName}
              placeholder="Nombre descriptivo de la sala"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNewRoomModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCreateHostRoom}
              >
                <Text style={styles.modalConfirmBtnText}>Crear e Ingresar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  userBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userNameText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  userRoleText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  logoutBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  actionsContainer: {
    gap: 10,
    marginBottom: 18,
  },
  joinBox: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 12,
    padding: 12,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  joinActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hostActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(232, 195, 158, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.30)',
    borderRadius: 10,
    paddingVertical: 10,
  },
  hostActionBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  soloActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 10,
    paddingVertical: 10,
  },
  soloActionBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  listSectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  listContainer: {
    gap: 10,
    paddingBottom: 20,
  },
  roomCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomCardLeft: {
    flex: 1,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingRight: 10,
  },
  roomIdBadge: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  roomIdText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeUsers: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  roomName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  projectCode: {
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  lastUpdated: {
    color: colors.textMuted,
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    padding: 18,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 14,
    lineHeight: 15,
  },
  modalInput: {
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalConfirmBtnText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
});
