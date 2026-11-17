import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/uml_model.dart';
import '../services/codegen_service.dart';
import '../theme/app_colors.dart';

class ClassDetailModal extends StatefulWidget {
  final UmlClass umlClass;

  const ClassDetailModal({super.key, required this.umlClass});

  static void show(BuildContext context, UmlClass umlClass) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ClassDetailModal(umlClass: umlClass),
    );
  }

  @override
  State<ClassDetailModal> createState() => _ClassDetailModalState();
}

class _ClassDetailModalState extends State<ClassDetailModal> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late String _javaCode;
  late String _sqlDdl;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _javaCode = CodegenService.generateJavaJpa(widget.umlClass);
    _sqlDdl = CodegenService.generateSqlDdl(widget.umlClass);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copiado al portapapeles'),
        duration: const Duration(seconds: 2),
        backgroundColor: AppColors.surfaceLight,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.of(context).size.height * 0.85;

    return Container(
      height: height,
      decoration: const BoxDecoration(
        color: AppColors.surfaceModal,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top: BorderSide(color: AppColors.borderGlass, width: 1.5),
        ),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 6),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.borderGlass,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withAlpha(35),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: AppColors.primary.withAlpha(90)),
                            ),
                            child: Text(
                              '«${widget.umlClass.stereotype}»',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                          if (widget.umlClass.tableName != null) ...[
                            const SizedBox(width: 8),
                            Text(
                              'tabla: ${widget.umlClass.tableName}',
                              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        widget.umlClass.name,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(LucideIcons.x, color: AppColors.textMuted),
                  onPressed: () => Navigator.of(context).pop(),
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
              Tab(text: 'Estructura UML'),
              Tab(text: 'Java 17 (JPA)'),
              Tab(text: 'PostgreSQL (DDL)'),
            ],
          ),

          // Tab content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // Tab 1: UML Structure
                _buildUmlStructureTab(),

                // Tab 2: Java 17 JPA
                _buildCodeTab(_javaCode, 'Java JPA'),

                // Tab 3: PostgreSQL DDL
                _buildCodeTab(_sqlDdl, 'Esquema SQL DDL'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUmlStructureTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Attributes section
        Row(
          children: [
            const Icon(LucideIcons.list, size: 16, color: AppColors.primary),
            const SizedBox(width: 8),
            Text(
              'Atributos (${widget.umlClass.attributes.length})',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (widget.umlClass.attributes.isEmpty)
          const Text('No se definieron atributos', style: TextStyle(color: AppColors.textMuted, fontSize: 12))
        else
          ...widget.umlClass.attributes.map((attr) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.borderGlass),
              ),
              child: Row(
                children: [
                  if (attr.isPrimaryKey)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withAlpha(40),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text('PK', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.primary)),
                    )
                  else if (attr.isForeignKey)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: AppColors.secondary.withAlpha(40),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text('FK', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.secondary)),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Text(attr.visibility, style: const TextStyle(fontFamily: 'monospace', color: AppColors.textMuted)),
                    ),
                  Expanded(
                    child: Text(
                      attr.name,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                  ),
                  Text(
                    attr.type,
                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace', color: AppColors.secondary),
                  ),
                ],
              ),
            );
          }),

        const SizedBox(height: 20),

        // Methods section
        Row(
          children: [
            const Icon(LucideIcons.code, size: 16, color: AppColors.accentEmerald),
            const SizedBox(width: 8),
            Text(
              'Métodos y Operaciones (${widget.umlClass.methods.length})',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (widget.umlClass.methods.isEmpty)
          const Text('No se definieron métodos', style: TextStyle(color: AppColors.textMuted, fontSize: 12))
        else
          ...widget.umlClass.methods.map((m) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.borderGlass),
              ),
              child: Row(
                children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Text(m.visibility, style: const TextStyle(fontFamily: 'monospace', color: AppColors.accentEmerald)),
                  ),
                  Expanded(
                    child: Text(
                      '${m.name}(${m.parameters})',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                  ),
                  Text(
                    m.returnType,
                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace', color: AppColors.textSecondary),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildCodeTab(String code, String label) {
    final lines = CodegenService.formatCodeWithLineNumbers(code);

    return Column(
      children: [
        // Action bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${lines.length} líneas generadas',
                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                icon: const Icon(LucideIcons.copy, size: 14),
                label: const Text('Copiar', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                onPressed: () => _copyToClipboard(code, label),
              ),
            ],
          ),
        ),

        // Code viewer
        Expanded(
          child: Container(
            margin: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.backgroundDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderGlass),
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                width: 600,
                child: ListView.builder(
                  itemCount: lines.length,
                  itemBuilder: (context, idx) {
                    final item = lines[idx];
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 32,
                          child: Text(
                            '${item.lineNumber}',
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 11,
                              color: AppColors.textMuted,
                            ),
                            textAlign: TextAlign.right,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            item.content,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
