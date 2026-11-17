import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'api/auth_api.dart';
import 'models/auth_model.dart';
import 'screens/login_screen.dart';
import 'screens/rooms_screen.dart';
import 'theme/app_colors.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set system bar styles for dark immersion
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.backgroundDark,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Check saved session
  final savedSession = await AuthApi.getSavedSession();

  runApp(ArchAiApp(initialSession: savedSession));
}

class ArchAiApp extends StatelessWidget {
  final UserSession? initialSession;

  const ArchAiApp({super.key, this.initialSession});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ArchAI Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppColors.themeData,
      home: initialSession != null
          ? RoomsScreen(session: initialSession!)
          : const LoginScreen(),
    );
  }
}
