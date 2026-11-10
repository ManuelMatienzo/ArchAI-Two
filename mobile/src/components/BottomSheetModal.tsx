import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { ShieldCheck, Layers, FileCode, Database, X } from 'lucide-react-native';
import { UmlClass } from '../types/uml';
import { colors } from '../theme/colors';
import { generateJavaJpa, generateSqlDdl } from '../services/codegen/codeGenerators';
import { CodeViewer } from './modal/CodeViewer';
import { UmlStructureViewer } from './modal/UmlStructureViewer';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  umlClass: UmlClass | null;
}

type TabKey = 'uml' | 'java' | 'sql';

/**
 * Hoja Deslizante Táctil de Inspección y Lectura de Código (Modo Viaje - Solo Lectura).
 * Proporciona acceso inmediato a la estructura UML de la clase, su entidad generada
 * en Java 17 JPA y su esquema relacional DDL PostgreSQL con copiado al portapapeles.
 */
export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  umlClass,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('uml');

  // Generación sintáctica determinista en cliente (memorizada por clase)
  const javaCode = useMemo(() => {
    return umlClass ? generateJavaJpa(umlClass) : '';
  }, [umlClass]);

  const sqlCode = useMemo(() => {
    return umlClass ? generateSqlDdl(umlClass) : '';
  }, [umlClass]);

  if (!umlClass) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Fondo táctil para cerrar el modal */}
        <TouchableOpacity
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={1}
          accessibilityLabel="Cerrar modal"
        />

        <View style={styles.sheetContainer}>
          {/* Manija táctil superior (Handle Bar) */}
          <View style={styles.handleBar} />

          {/* Encabezado de la Clase */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={styles.stereotypeBadge}>
                <Text style={styles.stereotype}>
                  «{umlClass.stereotype || 'Entity'}»
                </Text>
              </View>
              <Text style={styles.className} numberOfLines={1}>
                {umlClass.name}
              </Text>
              {umlClass.tableName && (
                <Text style={styles.tableName}>
                  Tabla: {umlClass.tableName}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Cerrar inspector"
            >
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Selector Ergonómico de 3 Pestañas */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'uml' && styles.tabButtonActive]}
              onPress={() => setActiveTab('uml')}
              activeOpacity={0.75}
            >
              <Layers
                size={13}
                color={activeTab === 'uml' ? colors.primary : colors.textMuted}
                style={styles.tabIcon}
              />
              <Text style={[styles.tabText, activeTab === 'uml' && styles.tabTextActive]}>
                UML
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'java' && styles.tabButtonActive]}
              onPress={() => setActiveTab('java')}
              activeOpacity={0.75}
            >
              <FileCode
                size={13}
                color={activeTab === 'java' ? colors.primary : colors.textMuted}
                style={styles.tabIcon}
              />
              <Text style={[styles.tabText, activeTab === 'java' && styles.tabTextActive]}>
                Java JPA
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'sql' && styles.tabButtonActive]}
              onPress={() => setActiveTab('sql')}
              activeOpacity={0.75}
            >
              <Database
                size={13}
                color={activeTab === 'sql' ? colors.primary : colors.textMuted}
                style={styles.tabIcon}
              />
              <Text style={[styles.tabText, activeTab === 'sql' && styles.tabTextActive]}>
                SQL DDL
              </Text>
            </TouchableOpacity>
          </View>

          {/* Contenido según la pestaña activa */}
          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {activeTab === 'uml' && (
              <UmlStructureViewer umlClass={umlClass} />
            )}

            {activeTab === 'java' && (
              <CodeViewer
                code={javaCode}
                languageLabel="Java 17 / Jakarta Persistence (JPA)"
                icon={<FileCode size={13} color={colors.primary} />}
              />
            )}

            {activeTab === 'sql' && (
              <CodeViewer
                code={sqlCode}
                languageLabel="PostgreSQL 14+ DDL"
                icon={<Database size={13} color={colors.primary} />}
              />
            )}

            {/* Aviso Permanente de Modo Viaje (100% Solo Lectura) */}
            <View style={styles.readOnlyNotice}>
              <ShieldCheck size={14} color="#38bdf8" style={styles.shieldIcon} />
              <Text style={styles.readOnlyText}>
                MODO VIAJE ACTIVO · Consulta y exportación de código habilitadas. La edición de clases y relaciones está restringida a la versión de escritorio.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 16, 0.72)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.28)',
    maxHeight: '84%',
    paddingHorizontal: 18,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  handleBar: {
    width: 42,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(232, 195, 158, 0.35)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 195, 158, 0.16)',
    paddingBottom: 10,
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  stereotypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 3,
  },
  stereotype: {
    fontSize: 10,
    color: colors.primary,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  className: {
    fontSize: 19,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  tableName: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.16)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 7,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(232, 195, 158, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.40)',
  },
  tabIcon: {
    marginRight: 5,
  },
  tabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  body: {
    marginTop: 14,
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.22)',
    marginTop: 4,
    marginBottom: 20,
  },
  shieldIcon: {
    marginRight: 8,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 11,
    color: '#38bdf8',
    lineHeight: 15,
    fontWeight: '500',
  },
});
