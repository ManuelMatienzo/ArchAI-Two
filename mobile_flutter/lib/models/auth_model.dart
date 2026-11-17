class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? avatarColor;
  final bool isHost;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.avatarColor,
    this.isHost = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? 'usr-anon',
      name: json['name']?.toString() ?? json['nombre']?.toString() ?? 'Usuario',
      email: json['email']?.toString() ?? json['correo']?.toString() ?? '',
      role: json['role']?.toString() ?? json['rol']?.toString() ?? 'DESARROLLADOR_MOVIL',
      avatarColor: json['avatarColor']?.toString() ?? json['colorAvatar']?.toString() ?? '#38BDF8',
      isHost: json['isHost'] == true || json['anfitrion'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'avatarColor': avatarColor,
      'isHost': isHost,
    };
  }
}

class UserSession {
  final String token;
  final UserModel user;
  final String? roomId;

  UserSession({
    required this.token,
    required this.user,
    this.roomId,
  });

  factory UserSession.fromJson(Map<String, dynamic> json) {
    return UserSession(
      token: json['token']?.toString() ?? '',
      user: UserModel.fromJson(json['user'] ?? json['currentUser'] ?? {}),
      roomId: json['roomId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'token': token,
      'user': user.toJson(),
      'roomId': roomId,
    };
  }
}
