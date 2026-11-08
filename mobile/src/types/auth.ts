export interface MobileUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
  isHost?: boolean;
}

export interface AuthSession {
  token?: string;
  user: MobileUser;
  roomId: string;
  roomName: string;
  isLocalMode?: boolean;
}

export interface QuickProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  specialty: string;
  color: string;
  initial: string;
}
