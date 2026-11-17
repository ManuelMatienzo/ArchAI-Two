import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../api/auth_api.dart';
import '../api/rooms_api.dart';
import '../models/auth_model.dart';
import '../models/room_model.dart';
import '../theme/app_colors.dart';
import '../widgets/glass_card.dart';
import 'canvas_viewer_screen.dart';
import 'login_screen.dart';
import 'notifications_screen.dart';
import 'settings_screen.dart';

class RoomsScreen extends StatefulWidget {
  final UserSession session;

  const RoomsScreen({super.key, required this.session});

  @override
  State<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends State<RoomsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _pinController = TextEditingController();
  final TextEditingController _projectSearchController = TextEditingController();




  List<ProjectItem> _projects = [];
  List<Map<String, dynamic>> _activeRooms = [];
  bool _isLoading = false;
  String? _openingProjectId;
  String _projectSearchQuery = '';
  String _selectedFilter = 'TODOS'; // 'TODOS' | 'MIS_PROYECTOS' | 'COMPARTIDOS'
  final Set<String> _expandedProjectIds = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _projectSearchController.addListener(() {
      setState(() {
        _projectSearchQuery = _projectSearchController.text.trim().toLowerCase();
      });
    });
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _pinController.dispose();
    _projectSearchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final pList = await RoomsApi.listUserProjects(widget.session.user.id);
      final rList = await RoomsApi.listActiveRooms(widget.session.user.id);
      if (mounted) {
        setState(() {
          _projects = pList;
          _activeRooms = rList;
        });
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('No se pudieron cargar los proyectos. Intenta de nuevo más tarde.'),
        ));
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _joinRoomWithPin(String pin) async {
    final cleanPin = pin.trim().toUpperCase();
    if (cleanPin.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ingresa un PIN válido para unirte')));
      return;
    }
    try {
      final room = await RoomsApi.joinRoom(cleanPin, widget.session.user);
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => CanvasViewerScreen(
        session: widget.session,
        roomId: room['roomId']?.toString() ?? cleanPin,
        roomName: room['roomName']?.toString() ?? 'Sala $cleanPin',
        projectId: room['projectId']?.toString(),
        diagramId: room['diagramId']?.toString(),
      )));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se pudo entrar a la sala. Verifica el código y vuelve a intentarlo.')));
    }
  }

  Future<void> _openDiagramInStudio(ProjectItem proj, [ProjectDiagramSummary? diag]) async {
    if (_openingProjectId != null) return;
    setState(() => _openingProjectId = proj.id);
    try {
      final entry = await RoomsApi.prepareProjectViewer(proj, diag);
      if (!mounted) return;
      if (entry == null) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('No hay diagramas guardados en este proyecto.'),
        ));
        return;
      }
      setState(() => _openingProjectId = null);
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => CanvasViewerScreen(
        session: widget.session,
        roomId: entry.roomId,
        roomName: '${proj.name} · ${entry.diagram.title}',
        projectId: proj.id,
        diagramId: entry.diagram.id.isEmpty ? null : entry.diagram.id,
        initialClasses: entry.data.classes,
        initialRelationships: entry.data.relationships,
        enableLiveSync: entry.live,
      )));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('No se pudo cargar el diagrama. Intenta de nuevo.'),
        ));
      }
    } finally {
      if (mounted && _openingProjectId == proj.id) setState(() => _openingProjectId = null);
    }
  }

  void _showProjectMembersModal(ProjectItem project) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surfaceModal,
      builder: (context) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(title: Text('Equipo · ${project.name}', style: const TextStyle(color: AppColors.textPrimary)),
          trailing: IconButton(icon: const Icon(LucideIcons.x), onPressed: () => Navigator.pop(context))),
        Flexible(child: project.members.isEmpty
            ? const Padding(padding: EdgeInsets.all(24), child: Text('No hay miembros para mostrar.', style: TextStyle(color: AppColors.textSecondary)))
            : ListView.builder(shrinkWrap: true, itemCount: project.members.length, itemBuilder: (context, index) {
                final member = project.members[index];
                return ListTile(leading: const Icon(LucideIcons.user, color: AppColors.primary),
                  title: Text(member.name, style: const TextStyle(color: AppColors.textPrimary)),
                  subtitle: Text(member.role, style: const TextStyle(color: AppColors.textSecondary)));
              })),
      ])),
    );
  }

  Future<void> _logout() async {
    await AuthApi.logout();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  Color _parseColor(String hex) {
    try {
      final clean = hex.replaceAll('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return AppColors.secondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.session.user;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: Column(
          children: [
            // Top user bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: AppColors.surfaceGlass,
                border: Border(bottom: BorderSide(color: AppColors.borderGlass)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppColors.primary,
                    radius: 18,
                    child: Text(
                      user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.name,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          user.role,
                          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.bell, size: 20, color: AppColors.textSecondary),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => NotificationsScreen(session: widget.session),
                        ),
                      );
                    },
                    tooltip: 'Actividad del Equipo',
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.settings, size: 20, color: AppColors.textSecondary),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SettingsScreen()),
                      );
                    },
                    tooltip: 'Ajustes',
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.logOut, size: 20, color: AppColors.accentRose),
                    onPressed: _logout,
                    tooltip: 'Cerrar Sesión',
                  ),
                ],
              ),
            ),

            // Tabs
            TabBar(
              controller: _tabController,
              indicatorColor: AppColors.primary,
              indicatorWeight: 2.5,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textSecondary,
              tabs: const [
                Tab(text: 'Hub de Proyectos'),
                Tab(text: 'Salas en Vivo'),
              ],
            ),

            // Tab contents
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        // Tab 1: Hub de Proyectos (CU-02)
                        _buildProjectsHubTab(),

                        // Tab 2: Salas en Vivo (CU-03)
                        _buildRoomsTab(),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProjectsHubTab() {
    final mineCount = _projects.where((p) => p.isOwner).length;
    final sharedCount = _projects.where((p) => !p.isOwner).length;

    final filteredProjects = _projects.where((p) {
      if (_selectedFilter == 'MIS_PROYECTOS' && !p.isOwner) return false;
      if (_selectedFilter == 'COMPARTIDOS' && p.isOwner) return false;

      if (_projectSearchQuery.isEmpty) return true;
      final q = _projectSearchQuery;
      return p.name.toLowerCase().contains(q) ||
          p.description.toLowerCase().contains(q) ||
          p.codigoAcceso.toLowerCase().contains(q);
    }).toList();

    final totalMembers = _projects.fold<int>(0, (sum, p) => sum + p.memberCount);
    final totalDiagrams = _projects.fold<int>(
      0,
      (sum, p) => sum + (p.diagrams.isNotEmpty ? p.diagrams.length : p.totalDiagrams),
    );

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. Hero Metrics Panel (4 KPIs: Proyectos, Miembros, Diagramas, Madurez)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surfaceGlass,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.borderGlass),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildMetricColumn('${_projects.length}', 'Proyectos', LucideIcons.folder, AppColors.primary),
                Container(height: 28, width: 1, color: AppColors.borderGlass),
                _buildMetricColumn('$totalMembers', 'Miembros', LucideIcons.users, AppColors.secondary),
                Container(height: 28, width: 1, color: AppColors.borderGlass),
                _buildMetricColumn('$totalDiagrams', 'Diagramas', LucideIcons.layers, AppColors.accentEmerald),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // 3. Filter Chips: [ Todos ] [ Mis Proyectos ] [ Compartidos ]
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('TODOS', 'Todos (${_projects.length})'),
                const SizedBox(width: 8),
                _buildFilterChip('MIS_PROYECTOS', 'Mis Proyectos ($mineCount)'),
                const SizedBox(width: 8),
                _buildFilterChip('COMPARTIDOS', 'Compartidos ($sharedCount)'),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 4. Search input
          Container(
            decoration: BoxDecoration(
              color: AppColors.surfaceLight,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.borderGlass),
            ),
            child: TextField(
              controller: _projectSearchController,
              style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Buscar por nombre o código (ej. SISTEM-1071)...',
                hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                prefixIcon: const Icon(LucideIcons.search, size: 18, color: AppColors.textMuted),
                suffixIcon: _projectSearchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(LucideIcons.x, size: 16, color: AppColors.textMuted),
                        onPressed: () => _projectSearchController.clear(),
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                isDense: true,
              ),
            ),
          ),

          const SizedBox(height: 14),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Espacios de Trabajo (${filteredProjects.length})',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              if (_projectSearchQuery.isNotEmpty)
                Text(
                  'Filtrado por: "$_projectSearchQuery"',
                  style: const TextStyle(fontSize: 11, color: AppColors.secondary),
                ),
            ],
          ),
          const SizedBox(height: 10),

          // 5. Project Cards List
          if (filteredProjects.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 36),
              child: Center(
                child: Column(
                  children: [
                    Icon(LucideIcons.folderOpen, size: 48, color: AppColors.textMuted.withAlpha(90)),
                    const SizedBox(height: 10),
                    Text(
                      _projectSearchQuery.isEmpty
                          ? 'No tienes proyectos asignados en esta sección'
                          : 'No se encontraron proyectos con ese criterio',
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                    ),

                  ],
                ),
              ),
            )
          else
            ...filteredProjects.map((proj) {
              return _buildProjectCard(proj);
            }),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String filterKey, String label) {
    final isSelected = _selectedFilter == filterKey;
    return GestureDetector(
      onTap: () => setState(() => _selectedFilter = filterKey),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withAlpha(35) : AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.borderGlass,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? AppColors.primary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildMetricColumn(String count, String label, IconData icon, Color color) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(
              count,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
        ),
      ],
    );
  }

  Widget _buildProjectCard(ProjectItem proj) {
    final projColor = _parseColor(proj.iconoColor);
    final isExpanded = _expandedProjectIds.contains(proj.id);
    final effectiveDiagrams = proj.diagrams;
    final totalDiags = effectiveDiagrams.isNotEmpty ? effectiveDiagrams.length : proj.totalDiagrams;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: AppColors.surfaceGlass,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderGlass),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(80),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row: Color icon, Title, Access Code pill, popup menu
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: projColor.withAlpha(40),
                      child: Icon(LucideIcons.gitFork, color: projColor, size: 18),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            proj.name,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          // Access code chip with 1-tap copy
                          GestureDetector(
                            onTap: () {
                              Clipboard.setData(ClipboardData(text: proj.codigoAcceso));
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Código ${proj.codigoAcceso} copiado al portapapeles'),
                                  duration: const Duration(seconds: 2),
                                  backgroundColor: AppColors.surfaceLight,
                                ),
                              );
                            },
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary.withAlpha(30),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(color: AppColors.primary.withAlpha(80)),
                                  ),
                                  child: Text(
                                    proj.codigoAcceso,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(LucideIcons.copy, size: 11, color: AppColors.textMuted),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Actions menu
                    PopupMenuButton<String>(
                      icon: const Icon(LucideIcons.moreVertical, size: 18, color: AppColors.textMuted),
                      color: AppColors.surfaceModal,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      onSelected: (val) {
                        if (val == 'members') {
                          _showProjectMembersModal(proj);
                        } else if (val == 'copy_code') {
                          Clipboard.setData(ClipboardData(text: proj.codigoAcceso));
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Código ${proj.codigoAcceso} copiado')),
                          );

                        }
                      },
                      itemBuilder: (ctx) => [
                        const PopupMenuItem(
                          value: 'members',
                          child: Row(
                            children: [
                              Icon(LucideIcons.users, size: 16, color: AppColors.secondary),
                              SizedBox(width: 8),
                              Text('Ver miembros', style: TextStyle(color: AppColors.textPrimary, fontSize: 12)),
                            ],
                          ),
                        ),
                        const PopupMenuItem(
                          value: 'copy_code',
                          child: Row(
                            children: [
                              Icon(LucideIcons.copy, size: 16, color: AppColors.textSecondary),
                              SizedBox(width: 8),
                              Text('Copiar Código Acceso', style: TextStyle(color: AppColors.textPrimary, fontSize: 12)),
                            ],
                          ),
                        ),

                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 8),

                // Description
                Text(
                  proj.description.isNotEmpty ? proj.description : 'Sin descripción proporcionada.',
                  style: const TextStyle(fontSize: 12, height: 1.35, color: AppColors.textSecondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),

                const SizedBox(height: 12),
                const Divider(height: 1, color: AppColors.borderGlass),
                const SizedBox(height: 10),

                // Meta Bar: Role Badge + Quick Action Pills
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: proj.isOwner ? AppColors.primary.withAlpha(30) : AppColors.secondary.withAlpha(30),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: proj.isOwner ? AppColors.primary.withAlpha(90) : AppColors.secondary.withAlpha(90),
                        ),
                      ),
                      child: Text(
                        proj.isOwner ? 'Propietario' : 'Colaborador',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: proj.isOwner ? AppColors.primary : AppColors.secondary,
                        ),
                      ),
                    ),
                    const Spacer(),

                    // Button: Members modal
                    InkWell(
                      borderRadius: BorderRadius.circular(6),
                      onTap: () => _showProjectMembersModal(proj),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.borderGlass),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(LucideIcons.users, size: 13, color: AppColors.secondary),
                            const SizedBox(width: 4),
                            Text(
                              '${proj.memberCount}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.secondary),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Button: Toggle Diagrams
                    InkWell(
                      borderRadius: BorderRadius.circular(6),
                      onTap: () {
                        setState(() {
                          if (isExpanded) {
                            _expandedProjectIds.remove(proj.id);
                          } else {
                            _expandedProjectIds.add(proj.id);
                          }
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isExpanded ? AppColors.primary.withAlpha(30) : AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isExpanded ? AppColors.primary : AppColors.borderGlass,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(LucideIcons.layers, size: 13, color: isExpanded ? AppColors.primary : AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              '$totalDiags diags',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: isExpanded ? AppColors.primary : AppColors.textMuted,
                              ),
                            ),
                            const SizedBox(width: 2),
                            Icon(
                              isExpanded ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                              size: 14,
                              color: isExpanded ? AppColors.primary : AppColors.textMuted,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Button: Open Studio
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                      icon: const Icon(LucideIcons.play, size: 14),
                      label: Text(_openingProjectId == proj.id ? 'Cargando…' : 'Abrir',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      onPressed: _openingProjectId != null ? null : () => _openDiagramInStudio(
                        proj,
                        effectiveDiagrams.isNotEmpty ? effectiveDiagrams.first : null,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Expandable Diagrams Section
          if (isExpanded)
            Container(
              decoration: BoxDecoration(
                color: Colors.black.withAlpha(60),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(14)),
                border: const Border(top: BorderSide(color: AppColors.borderGlass)),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Diagramas UML del Proyecto',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                      ),

                    ],
                  ),
                  const SizedBox(height: 8),

                  if (effectiveDiagrams.isEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      width: double.infinity,
                      child: Column(
                        children: [
                          Icon(LucideIcons.layers, size: 28, color: AppColors.textMuted.withAlpha(60)),
                          const SizedBox(height: 6),
                          Text(
                            proj.diagramsLoaded
                                ? 'No hay diagramas guardados en este proyecto.'
                                : 'Pulsa Abrir para cargar los diagramas.',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                          ),

                        ],
                      ),
                    )
                  else
                    ...effectiveDiagrams.map((diag) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.borderGlass),
                        ),
                        child: Row(
                          children: [
                            const Icon(LucideIcons.layers, size: 16, color: AppColors.accentEmerald),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    diag.title,
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    '${diag.totalClasses} clases · ${diag.totalRelations} rels',
                                    style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                                  ),
                                ],
                              ),
                            ),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.surfaceGlass,
                                foregroundColor: AppColors.primary,
                                side: const BorderSide(color: AppColors.primary),
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                              ),
                              onPressed: () => _openDiagramInStudio(proj, diag),
                              child: const Text('Lienzo', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                            ),

                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRoomsTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Join with PIN card
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Entrar con PIN de Sala en Vivo',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.borderGlass),
                        ),
                        child: TextField(
                          controller: _pinController,
                          style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                          decoration: const InputDecoration(
                            hintText: 'ej. ARC-GRUPO04',
                            hintStyle: TextStyle(fontSize: 12, color: AppColors.textMuted),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () => _joinRoomWithPin(_pinController.text),
                      child: const Text('Entrar', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          const Text(
            'Salas Activas en el Servidor',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textMuted),
          ),
          const SizedBox(height: 8),

          if (_activeRooms.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 30),
              child: Center(
                child: Column(
                  children: [
                    Icon(LucideIcons.doorClosed, size: 40, color: AppColors.textMuted.withAlpha(100)),
                    const SizedBox(height: 8),
                    const Text('No hay salas activas en este momento', style: TextStyle(color: AppColors.textMuted)),
                  ],
                ),
              ),
            )
          else
            ..._activeRooms.map((room) {
              final pin = room['pin'] ?? room['id'];
              return Card(
                color: AppColors.surfaceGlass,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppColors.borderGlass),
                ),
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  leading: CircleAvatar(
                    backgroundColor: AppColors.accentEmerald.withAlpha(30),
                    child: const Icon(LucideIcons.radio, color: AppColors.accentEmerald, size: 20),
                  ),
                  title: Text(
                    room['name'] ?? 'Sala $pin',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  subtitle: Text(
                    'PIN: $pin · ${room['activeUsers'] ?? 1} conectados',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  trailing: const Icon(LucideIcons.chevronRight, size: 14, color: AppColors.textMuted),
                  onTap: () => _joinRoomWithPin(pin),
                ),
              );
            }),
        ],
      ),
    );
  }

}
