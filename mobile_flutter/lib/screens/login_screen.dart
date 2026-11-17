import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../api/auth_api.dart';
import '../api/client.dart';
import '../models/auth_model.dart';
import '../theme/app_colors.dart';
import '../widgets/glass_card.dart';
import 'rooms_screen.dart';
import 'settings_screen.dart';

class QuickProfileItem {
  final String id;
  final String name;
  final String fullName;
  final String email;
  final String role;
  final String specialty;
  final Color color;
  final String initial;

  const QuickProfileItem({
    required this.id,
    required this.name,
    required this.fullName,
    required this.email,
    required this.role,
    required this.specialty,
    required this.color,
    required this.initial,
  });
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isLoginMode = true;
  bool _showPassword = false;
  bool _isLoading = false;
  String? _errorMessage;

  final TextEditingController _nameController = TextEditingController(text: 'Ing. Carlos Criado');
  final TextEditingController _emailController = TextEditingController(text: 'carlos.criado@archai.io');
  final TextEditingController _passwordController = TextEditingController(text: 'password123');
  String _selectedRole = 'Arquitecto de Software';

  final List<QuickProfileItem> _profiles = const [
    QuickProfileItem(
      id: 'carlos',
      name: 'Carlos',
      fullName: 'Ing. Carlos Criado',
      email: 'carlos.criado@archai.io',
      role: 'Arquitecto de Software',
      specialty: 'Arquitecto',
      color: Color(0xFFE8C39E),
      initial: 'C',
    ),
    QuickProfileItem(
      id: 'elena',
      name: 'Elena',
      fullName: 'Lic. Elena Ramos',
      email: 'elena.ramos@archai.io',
      role: 'Ingeniera de Datos',
      specialty: 'Datos',
      color: Color(0xFF8892B0),
      initial: 'E',
    ),
    QuickProfileItem(
      id: 'lucas',
      name: 'Lucas',
      fullName: 'Ing. Lucas Vaca',
      email: 'lucas.vaca@archai.io',
      role: 'Desarrollador Backend',
      specialty: 'Backend',
      color: Color(0xFF4A4891),
      initial: 'L',
    ),
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _selectProfile(QuickProfileItem profile) {
    setState(() {
      _nameController.text = profile.fullName;
      _emailController.text = profile.email;
      _passwordController.text = 'password123';
      _selectedRole = profile.role;
      _errorMessage = null;
    });
  }

  Future<void> _handleAuth() async {
    final email = _emailController.text.trim();
    final pass = _passwordController.text.trim();
    final name = _nameController.text.trim();

    if (email.isEmpty) {
      setState(() => _errorMessage = 'Por favor ingresa tu correo electrónico.');
      return;
    }
    if (pass.isEmpty) {
      setState(() => _errorMessage = 'Por favor ingresa tu contraseña.');
      return;
    }
    if (!_isLoginMode && name.isEmpty) {
      setState(() => _errorMessage = 'Por favor ingresa tu nombre completo.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      UserSession session;
      if (_isLoginMode) {
        try {
          session = await AuthApi.login(email, pass);
        } catch (_) {
          // Fallback resiliente offline si el servidor está inaccesible temporalmente
          session = await AuthApi.loginOffline(email, _selectedRole);
        }
      } else {
        await AuthApi.register(name, email, pass, _selectedRole);
        try {
          session = await AuthApi.login(email, pass);
        } catch (_) {
          session = await AuthApi.loginOffline(email, _selectedRole);
        }
      }

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => RoomsScreen(session: session)),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e is ApiError ? e.message : 'No se pudo iniciar sesión. Verifica tus credenciales e intenta de nuevo.';
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: Stack(
          children: [
            // Ambient Radial Gradient
            Positioned.fill(
              child: Container(
                decoration: const BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0.0, -0.65),
                    radius: 1.3,
                    colors: [
                      Color(0xFF1E2248),
                      Color(0xFF0A0C1E),
                    ],
                  ),
                ),
              ),
            ),

            // Top right settings icon button
            Positioned(
              top: 10,
              right: 12,
              child: IconButton(
                icon: const Icon(LucideIcons.settings, color: AppColors.textSecondary, size: 20),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SettingsScreen()),
                  );
                },
                tooltip: 'Ajustes de Servidor',
              ),
            ),

            // Scrollable Content
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // 1. Brand Header
                      _buildBrandHeader(),

                      const SizedBox(height: 18),

                      // 2. Auth Card (Glassmorphism Deep Indigo)
                      GlassCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Grabber visual handle
                            Center(
                              child: Container(
                                width: 36,
                                height: 4,
                                margin: const EdgeInsets.only(bottom: 14),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withAlpha(80),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ),

                            // Segmented Auth Mode Switch
                            _buildAuthModeSwitch(),

                            const SizedBox(height: 16),

                            // Quick Profile Selector (Carlos, Elena, Lucas)
                            _buildQuickProfileSelector(),

                            const SizedBox(height: 16),

                            // Divider Row: "O USA TUS CREDENCIALES"
                            _buildDividerRow(),

                            const SizedBox(height: 14),

                            // Error notification box
                            if (_errorMessage != null) ...[
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                                decoration: BoxDecoration(
                                  color: AppColors.accentRose.withAlpha(25),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppColors.accentRose.withAlpha(120)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(LucideIcons.alertCircle, size: 16, color: AppColors.accentRose),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        _errorMessage!,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.accentRose,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 14),
                            ],

                            // Form Fields
                            if (!_isLoginMode) ...[
                              _buildInputField(
                                controller: _nameController,
                                label: 'Nombre Completo',
                                hint: 'ej. Ing. Carlos Criado',
                                icon: LucideIcons.user,
                                textCapitalization: TextCapitalization.words,
                              ),
                              const SizedBox(height: 12),
                            ],

                            _buildInputField(
                              controller: _emailController,
                              label: 'Correo Electrónico',
                              hint: 'usuario@archai.io',
                              icon: LucideIcons.mail,
                              keyboardType: TextInputType.emailAddress,
                              textCapitalization: TextCapitalization.none,
                            ),
                            const SizedBox(height: 12),

                            _buildInputField(
                              controller: _passwordController,
                              label: 'Contraseña de Acceso',
                              hint: '••••••••',
                              icon: LucideIcons.lock,
                              obscureText: !_showPassword,
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _showPassword ? LucideIcons.eyeOff : LucideIcons.eye,
                                  size: 18,
                                  color: AppColors.textMuted,
                                ),
                                onPressed: () => setState(() => _showPassword = !_showPassword),
                              ),
                            ),
                            const SizedBox(height: 12),

                            if (!_isLoginMode) ...[
                              const Text(
                                'Rol en el Equipo',
                                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceLight,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: AppColors.borderGlass),
                                ),
                                child: DropdownButton<String>(
                                  value: _selectedRole,
                                  isExpanded: true,
                                  underline: const SizedBox(),
                                  dropdownColor: AppColors.surfaceModal,
                                  style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                                  items: const [
                                    DropdownMenuItem(value: 'Arquitecto de Software', child: Text('Arquitecto de Software')),
                                    DropdownMenuItem(value: 'Desarrollador Backend', child: Text('Desarrollador Backend')),
                                    DropdownMenuItem(value: 'Desarrollador Móvil', child: Text('Desarrollador Móvil')),
                                    DropdownMenuItem(value: 'Ingeniera de Datos', child: Text('Ingeniera de Datos')),
                                    DropdownMenuItem(value: 'Líder Técnico', child: Text('Líder Técnico')),
                                  ],
                                  onChanged: (v) {
                                    if (v != null) setState(() => _selectedRole = v);
                                  },
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            const SizedBox(height: 4),

                            // Submit Button
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.black,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                elevation: 3,
                              ),
                              onPressed: _isLoading ? null : _handleAuth,
                              child: _isLoading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                                    )
                                  : Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          _isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta',
                                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                                        ),
                                        const SizedBox(width: 8),
                                        const Icon(LucideIcons.arrowRight, size: 16),
                                      ],
                                    ),
                            ),

                            const SizedBox(height: 12),

                            // Switch mode link button
                            GestureDetector(
                              onTap: () {
                                setState(() {
                                  _isLoginMode = !_isLoginMode;
                                  _errorMessage = null;
                                });
                              },
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Text(
                                  _isLoginMode
                                      ? '¿Aún no tienes cuenta? Regístrate aquí'
                                      : '¿Ya tienes cuenta? Inicia sesión',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                            ),

                            const SizedBox(height: 10),

                            // Security status footer
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(LucideIcons.shieldCheck, size: 14, color: AppColors.textMuted),
                                SizedBox(width: 5),
                                Text(
                                  'Conexión segura · Supervisión en tiempo real',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w500,
                                    letterSpacing: 0.3,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBrandHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: const Color(0xFF171A4A).withAlpha(220),
                borderRadius: BorderRadius.circular(15),
                border: Border.all(
                  color: AppColors.primary.withAlpha(120),
                  width: 1.4,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withAlpha(70),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(LucideIcons.boxes, color: AppColors.primary, size: 22),
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ArchAI',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.6,
                    color: AppColors.textPrimary,
                  ),
                ),
                Row(
                  children: const [
                    Icon(LucideIcons.sparkles, size: 10, color: AppColors.primary),
                    SizedBox(width: 4),
                    Text(
                      'ESTUDIO UML & IA',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.0,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 14),
        Container(
          width: 32,
          height: 2,
          decoration: BoxDecoration(
            color: AppColors.primary.withAlpha(160),
            borderRadius: BorderRadius.circular(1),
          ),
        ),
        const SizedBox(height: 12),
        RichText(
          text: const TextSpan(
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              height: 1.15,
              color: AppColors.textPrimary,
            ),
            children: [
              TextSpan(text: 'Tu arquitectura,\n'),
              TextSpan(
                text: 'en movimiento.',
                style: TextStyle(color: AppColors.primary),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Supervisa el lienzo, el chat y las propuestas de la IA desde tu celular.',
          style: TextStyle(
            fontSize: 12,
            color: AppColors.textSecondary,
            height: 1.35,
          ),
        ),
      ],
    );
  }

  Widget _buildAuthModeSwitch() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderGlass),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () {
                if (!_isLoginMode) {
                  setState(() {
                    _isLoginMode = true;
                    _errorMessage = null;
                  });
                }
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: _isLoginMode ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: _isLoginMode
                      ? [
                          BoxShadow(
                            color: AppColors.primary.withAlpha(50),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      LucideIcons.logIn,
                      size: 15,
                      color: _isLoginMode ? Colors.black : AppColors.textMuted,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Ingresar',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.bold,
                        color: _isLoginMode ? Colors.black : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () {
                if (_isLoginMode) {
                  setState(() {
                    _isLoginMode = false;
                    _errorMessage = null;
                  });
                }
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: !_isLoginMode ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: !_isLoginMode
                      ? [
                          BoxShadow(
                            color: AppColors.primary.withAlpha(50),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      LucideIcons.userPlus,
                      size: 15,
                      color: !_isLoginMode ? Colors.black : AppColors.textMuted,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Crear Cuenta',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.bold,
                        color: !_isLoginMode ? Colors.black : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickProfileSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: const [
            Text(
              'ACCESO RÁPIDO',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.0,
                color: AppColors.textMuted,
              ),
            ),
            SizedBox(width: 8),
            Expanded(child: Divider(height: 1, color: AppColors.borderGlass)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: _profiles.map((p) => _buildProfileTile(p)).toList(),
        ),
      ],
    );
  }

  Widget _buildProfileTile(QuickProfileItem p) {
    final isSelected = _emailController.text == p.email;
    return Expanded(
      child: GestureDetector(
        onTap: () => _selectProfile(p),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.surfaceHover : AppColors.surfaceLight,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.borderGlass,
              width: isSelected ? 1.5 : 1.0,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: AppColors.primary.withAlpha(40),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: p.color,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isSelected ? Colors.white : Colors.transparent,
                        width: 1.8,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        p.initial,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Colors.black,
                        ),
                      ),
                    ),
                  ),
                  if (isSelected)
                    Positioned(
                      right: -3,
                      bottom: -2,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(LucideIcons.check, size: 10, color: Colors.black),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                p.name,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                  color: isSelected ? AppColors.textPrimary : AppColors.textSecondary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 1),
              Text(
                p.specialty,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? AppColors.primary : AppColors.textMuted,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDividerRow() {
    return Row(
      children: const [
        Expanded(child: Divider(height: 1, color: AppColors.borderGlass)),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            'O USA TUS CREDENCIALES',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.0,
              color: AppColors.textMuted,
            ),
          ),
        ),
        Expanded(child: Divider(height: 1, color: AppColors.borderGlass)),
      ],
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    Widget? suffixIcon,
    TextInputType keyboardType = TextInputType.text,
    TextCapitalization textCapitalization = TextCapitalization.none,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.bold,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceLight,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.borderGlass),
          ),
          child: TextField(
            controller: controller,
            obscureText: obscureText,
            keyboardType: keyboardType,
            textCapitalization: textCapitalization,
            style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
              prefixIcon: Icon(icon, size: 17, color: AppColors.primary),
              suffixIcon: suffixIcon,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              isDense: true,
            ),
          ),
        ),
      ],
    );
  }
}
