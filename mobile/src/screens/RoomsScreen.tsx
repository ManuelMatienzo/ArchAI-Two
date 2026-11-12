import { disablePush } from '../services/notificationsService';
import { mobileStomp } from '../api/stompClient';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Radio, Folder } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { conversationApi } from '../api/conversationApi';
import { roomsApi, RoomItem, ProjectItem } from '../api/roomsApi';
import {
  desactivarNotificacionesPush,
  sincronizarTokenPush,
  vincularSalaPush,
} from '../services/pushNotificationsService';
import {
  RoomsUserBar,
  RoomsSearchBar,
  RoomCardItem,
  JoinRoomCard,
  JoinProjectCard,
  CreateRoomModal,
  ProjectCardItem,
} from '../components/rooms';

export type HubTab = 'projects' | 'rooms';

export const RoomsScreen = ({ navigation }: any) => {
  const [activeTab, setActiveTab] = useState<HubTab>('projects');
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('Ing. Carlos Criado');
  const [userRole, setUserRole] = useState('Arquitecto de Software');
  const [isSessionReady, setIsSessionReady] = useState(false);

  // Filtro de búsqueda común
  const [searchQuery, setSearchQuery] = useState('');

  // Estado de Salas Colaborativas
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [roomCode, setRoomCode] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [newRoomModalVisible, setNewRoomModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('Sesión de Ingeniería UML');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [joinRoomErrorMessage, setJoinRoomErrorMessage] = useState<string | null>(null);
  const [createRoomErrorMessage, setCreateRoomErrorMessage] = useState<string | null>(null);

  // Salas que este usuario ha entrado (registro local para aislamiento por cuenta)
  const [joinedRooms, setJoinedRooms] = useState<Set<string>>(new Set());

  // Estado de Proyectos Segregados por Usuario (CU-02)
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectCodeInput, setProjectCodeInput] = useState('');
  const [isJoiningProject, setIsJoiningProject] = useState(false);
  const [projectErrorMessage, setProjectErrorMessage] = useState<string | null>(null);
  const [projectSuccessMessage, setProjectSuccessMessage] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Consulta de salas activas
  const fetchActiveRooms = useCallback(async () => {
    try {
      const activeRooms = await roomsApi.listActiveRooms(userId || undefined);
      setRooms(activeRooms);
      // El backend ya filtra por propietario/participante: estas son las salas del usuario.
      if (activeRooms.length > 0) {
        const ids = activeRooms.map((r) => r.id);
        setJoinedRooms((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.add(id));
          return next;
        });
        void AsyncStorage.setItem(
          `archai_rooms_joined_${userId}`,
          JSON.stringify([...new Set([...Array.from(joinedRooms), ...ids])])
        );
      }
    } catch {
      // Fallback silencioso
    } finally {
      setIsLoadingRooms(false);
      setIsRefreshing(false);
    }
  }, [userId, joinedRooms]);

  // Consulta de proyectos pertenecientes al usuario autenticado (CU-02: solo creados o integrados)
  const fetchUserProjects = useCallback(async () => {
    try {
      if (!userId) {
        setIsLoadingProjects(false);
        return;
      }
      const userProjects = await roomsApi.listUserProjects(userId);
      setProjects(userProjects);
    } catch {
      // Fallback silencioso
    } finally {
      setIsLoadingProjects(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  // Carga de sesión de usuario autenticado
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('archai_session')
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.user?.id) setUserId(String(parsed.user.id));
            if (parsed?.user?.name) setUserName(parsed.user.name);
            if (parsed?.user?.role) setUserRole(parsed.user.role);
          } catch {}
        }
      })
      .finally(() => {
        if (mounted) setIsSessionReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Carga el registro local de salas que este usuario ha entrado (aislamiento por cuenta)
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    AsyncStorage.getItem(`archai_rooms_joined_${userId}`)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) setJoinedRooms(new Set(arr));
          } catch {}
        }
      });
    return () => { mounted = false; };
  }, [userId]);

  // Cargar datos cuando la identidad esté lista
  useEffect(() => {
    if (!isSessionReady) return;
    fetchActiveRooms();
    fetchUserProjects();
  }, [isSessionReady, fetchActiveRooms, fetchUserProjects]);

  // CU-23 — Re-registra el token push con el usuario autenticado (si ya estaba activado).
  useEffect(() => {
    if (!isSessionReady || !userId) return;
    sincronizarTokenPush({ id: userId, name: userName }).catch(() => {});
  }, [isSessionReady, userId, userName]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchActiveRooms();
    fetchUserProjects();
  }, [fetchActiveRooms, fetchUserProjects]);

  // Filtrado de proyectos por nombre, código o descripción
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigoAcceso.toLowerCase().includes(q) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  // Filtrado reactivo de salas por nombre o código PIN
  const filteredRooms = useMemo(() => {
    let result = rooms;
    // Solo mostrar salas que este usuario ha entrado (o es propietario)
    if (joinedRooms.size > 0) {
      result = result.filter((r) => joinedRooms.has(r.id));
    }
    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase().trim();
    return result.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.projectCode && r.projectCode.toLowerCase().includes(q))
    );
  }, [rooms, searchQuery, joinedRooms]);

  // Unirse a un proyecto compartido por su código de acceso (CU-02)
  const handleJoinProjectByCode = async () => {
    const cleanCode = projectCodeInput.trim().toUpperCase();
    if (!cleanCode || isJoiningProject) return;

    setIsJoiningProject(true);
    setProjectErrorMessage(null);
    setProjectSuccessMessage(null);

    try {
      const targetUserId = userId || 'usr-admin-01';
      const joined = await roomsApi.joinProjectByCode(cleanCode, targetUserId);
      setProjectCodeInput('');
      setProjectSuccessMessage(`¡Te uniste con éxito a "${joined.nombre || cleanCode}"!`);
      setTimeout(() => setProjectSuccessMessage(null), 3500);
      await fetchUserProjects();
    } catch (err: any) {
      setProjectErrorMessage(
        err.message || 'No se encontró ningún proyecto con ese código de acceso.'
      );
      setTimeout(() => setProjectErrorMessage(null), 4000);
    } finally {
      setIsJoiningProject(false);
    }
  };

  // Selección de proyecto: abre el visor de canvas pasando projectId para cargar su diagrama
  const handleSelectProject = async (project: ProjectItem) => {
    try {
      const session = await conversationApi.resolve(project.codigoAcceso, project.id);
      navigation.navigate('CanvasViewer', {
        roomId: session.roomId,
        roomName: session.roomName,
        projectId: project.id,
        diagramId: session.diagramId,
      });
    } catch (e) {
      navigation.navigate('CanvasViewer', {
        roomId: project.codigoAcceso,
        roomName: project.nombre,
        projectId: project.id,
      });
    }
  };

  // Unirse a sala por PIN
  const handleJoinRoomByCode = async () => {
    if (!roomCode.trim() || isJoiningRoom) return;
    setIsJoiningRoom(true);
    setJoinRoomErrorMessage(null);

    const cleanPin = roomCode.trim().toUpperCase();
    const finalPin = cleanPin.startsWith('ARC-') ? cleanPin : `ARC-${cleanPin}`;

    try {
      const currentUser = {
        id: userId || undefined,
        name: userName,
        role: userRole,
      };
      const session = await roomsApi.joinRoom(finalPin, currentUser);
      fetchActiveRooms();
      vincularSalaPush({ id: userId, name: userName }, session.roomId || finalPin).catch(() => {});
      navigation.navigate('CanvasViewer', {
        roomId: session.roomId || finalPin,
        roomName: session.roomName || `Sala ${finalPin}`,diagramId:session.diagramId,projectId:session.projectId,
      });
    } catch (err: any) {
      setJoinRoomErrorMessage(err.message || 'No se pudo conectar con la sala. Verifica el PIN.');
      setTimeout(() => setJoinRoomErrorMessage(null), 4000);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleSelectRoom = (room: RoomItem) => {
    vincularSalaPush({ id: userId, name: userName }, room.id).catch(() => {});
    navigation.navigate('CanvasViewer', { roomId: room.id, roomName: room.name });
  };

  // Crear sala anfitrión
  const handleCreateHostRoom = async () => {
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);
    setCreateRoomErrorMessage(null);
    const generatedPin = 'ARC-' + Math.floor(100000 + Math.random() * 900000);
    try {
      const currentUser = {
        id: userId || undefined,
        name: userName,
        role: userRole,
      };
      const created = await roomsApi.createRoom(newRoomName, currentUser, generatedPin);
      setNewRoomModalVisible(false);
      fetchActiveRooms();
      vincularSalaPush({ id: userId, name: userName }, created.roomId || generatedPin).catch(() => {});
      navigation.navigate('CanvasViewer', {
        roomId: created.roomId || generatedPin,
        roomName: created.roomName || newRoomName,
      });
    } catch {
      setCreateRoomErrorMessage('No se pudo crear la sala. Intenta de nuevo más tarde.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleEnterLocalMode = () => {
    navigation.navigate('CanvasViewer', {
      roomId: 'LOCAL-MODE',
      roomName: 'Espacio Individual de Modelado',
    });
  };

  const handleLogout = async () => {
    await Promise.allSettled([disablePush(), desactivarNotificacionesPush()]);
    mobileStomp.disconnect();
    await AsyncStorage.removeItem('archai_session');
    await AsyncStorage.removeItem('archai_jwt_token');
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      {/* 1. Barra de Perfil Logueado con Ajustes y Salida */}
      <RoomsUserBar
        userName={userName}
        userRole={userRole}
        onOpenSettings={() => navigation.navigate('Settings')}
        onLogout={handleLogout}
      />

      {/* 2. Selector de Pestañas: Mis Proyectos vs Salas Colaborativas */}
      <View style={styles.tabSelectorRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'projects' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('projects');
            setSearchQuery('');
          }}
          activeOpacity={0.75}
          accessibilityRole="tab"
          accessibilityLabel="Pestaña Mis Proyectos"
        >
          <Folder
            size={14}
            color={activeTab === 'projects' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'projects' && styles.tabButtonTextActive]}
          >
            Mis Proyectos {projects.length > 0 ? `(${projects.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'rooms' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('rooms');
            setSearchQuery('');
          }}
          activeOpacity={0.75}
          accessibilityRole="tab"
          accessibilityLabel="Pestaña Salas en Vivo"
        >
          <Radio
            size={14}
            color={activeTab === 'rooms' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'rooms' && styles.tabButtonTextActive]}
          >
            Salas en Vivo {rooms.length > 0 ? `(${rooms.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Contenido condicional según la pestaña activa */}
      {activeTab === 'projects' ? (
        <>
          {/* Tarjeta de Unirse a Proyecto por Código de Acceso */}
          <JoinProjectCard
            projectCode={projectCodeInput}
            onChangeProjectCode={setProjectCodeInput}
            onJoin={handleJoinProjectByCode}
            isJoining={isJoiningProject}
            errorMessage={projectErrorMessage}
            successMessage={projectSuccessMessage}
          />

          {/* Buscador de Proyectos */}
          <RoomsSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="Filtrar por nombre o código de acceso..."
          />

          {/* Encabezado de Lista de Proyectos */}
          <View style={styles.listHeaderRow}>
            <Folder size={14} color={colors.primary} />
            <Text style={styles.listSectionTitle}>Proyectos de Tu Cuenta</Text>
          </View>

          {/* FlatList de Proyectos */}
          <FlatList
            data={filteredProjects}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              !isLoadingProjects ? (
                <View style={styles.emptyListContainer}>
                  <Text style={styles.emptyListText}>
                    {searchQuery
                      ? `No se encontraron proyectos que coincidan con "${searchQuery}"`
                      : 'No tienes proyectos asignados. Únete a uno ingresando su código de acceso arriba.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )
            }
            renderItem={({ item }) => (
              <ProjectCardItem
                project={item}
                currentUserId={userId}
                onSelect={handleSelectProject}
              />
            )}
          />
        </>
      ) : (
        <>
          {/* Tarjeta de Acceso a Salas Colaborativas */}
          <JoinRoomCard
            roomCode={roomCode}
            onChangeRoomCode={setRoomCode}
            onJoin={handleJoinRoomByCode}
            isJoining={isJoiningRoom}
            errorMessage={joinRoomErrorMessage}
            onCreateRoom={() => {
              setCreateRoomErrorMessage(null);
              setNewRoomModalVisible(true);
            }}
            onEnterLocalMode={handleEnterLocalMode}
          />

          {/* Buscador de Salas */}
          <RoomsSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="Filtrar por nombre o PIN..."
          />

          {/* Encabezado de Lista de Salas */}
          <View style={styles.listHeaderRow}>
            <Radio size={14} color={colors.primary} />
            <Text style={styles.listSectionTitle}>Mis Salas Colaborativas</Text>
          </View>

          {/* FlatList de Salas */}
          <FlatList
            data={filteredRooms}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              !isLoadingRooms ? (
                <View style={styles.emptyListContainer}>
                  <Text style={styles.emptyListText}>
                    {searchQuery
                      ? `No se encontraron salas que coincidan con "${searchQuery}"`
                      : 'No tienes salas activas. Crea una como anfitrión o únete con un PIN.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )
            }
            renderItem={({ item }) => (
              <RoomCardItem room={item} onSelect={handleSelectRoom} />
            )}
          />

          {/* Modal Crear Sala Nueva */}
          <CreateRoomModal
            visible={newRoomModalVisible}
            onClose={() => {
              setNewRoomModalVisible(false);
              setCreateRoomErrorMessage(null);
            }}
            roomName={newRoomName}
            onChangeRoomName={setNewRoomName}
            onConfirmCreate={handleCreateHostRoom}
            isCreating={isCreatingRoom}
            errorMessage={createRoomErrorMessage}
          />
        </>
      )}
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
  tabSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(23, 26, 74, 0.40)',
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(232, 195, 158, 0.16)',
    borderColor: colors.primary,
  },
  tabButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: colors.primary,
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
  emptyListContainer: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
