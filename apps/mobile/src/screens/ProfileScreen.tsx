import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslations';
import { colors, gradients, shadows } from '../utils/theme';
import { locales, Locale } from '@kiwi/i18n';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { isDark, theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useTranslation();

  const handleLogout = () => {
    Alert.alert(
      t.auth.logout,
      locale === 'es' ? '¿Estás seguro que deseas cerrar sesión?' : 'Are you sure you want to log out?',
      [
        { text: t.app.cancel, style: 'cancel' },
        { text: t.auth.logout, style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleLanguageChange = () => {
    Alert.alert(
      t.settings.language,
      locale === 'es' ? 'Selecciona tu idioma' : 'Select your language',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '🇨🇷 Español',
          onPress: () => setLocale('es'),
        },
        {
          text: '🇺🇸 English',
          onPress: () => setLocale('en'),
        },
      ]
    );
  };

  const menuItems = [
    { icon: 'person-outline', label: t.profile.editProfile, onPress: () => {} },
    { icon: 'car-outline', label: t.profile.myVehicle, onPress: () => {} },
    { icon: 'document-text-outline', label: t.profile.documents, onPress: () => {} },
    { icon: 'notifications-outline', label: t.profile.notifications, onPress: () => {} },
    { icon: 'language-outline', label: t.settings.language, onPress: handleLanguageChange },
    { icon: 'moon-outline', label: t.profile.darkMode, onPress: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    { icon: 'help-circle-outline', label: t.profile.help, onPress: () => {} },
    { icon: 'information-circle-outline', label: t.profile.about, onPress: () => {} },
  ];

  return (
    <SafeAreaView style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
    }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            {t.profile.title}
          </Text>
        </View>

        {/* Profile Card */}
        <LinearGradient
          colors={gradients.kiwi}
          style={[styles.profileCard, shadows.large]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.driverProfile?.fullName?.charAt(0) || 'D'}
              </Text>
            </View>
            <View style={styles.onlineIndicator} />
          </View>
          
          <Text style={styles.profileName}>
            {user?.driverProfile?.fullName || (locale === 'es' ? 'Repartidor' : 'Driver')}
          </Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          
          <View style={styles.profileStats}>
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>⭐ 4.9</Text>
              <Text style={styles.profileStatLabel}>{t.driver.rating}</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>156</Text>
              <Text style={styles.profileStatLabel}>{t.driver.totalTrips}</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>{t.profile.bronze}</Text>
              <Text style={styles.profileStatLabel}>{t.profile.level}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Menu Items */}
        <View style={[styles.menuCard, { 
          backgroundColor: isDark ? colors.surface[800] : '#fff' 
        }, shadows.soft]}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, index < menuItems.length - 1 && styles.menuItemBorder]}
              onPress={item.onPress}
            >
              <View style={styles.menuLeft}>
                <Ionicons 
                  name={item.icon as any} 
                  size={22} 
                  color={isDark ? colors.surface[300] : colors.surface[600]} 
                />
                <Text style={[styles.menuLabel, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                  {item.label}
                </Text>
              </View>
              <View style={styles.menuRight}>
                {item.icon === 'language-outline' && (
                  <Text style={[styles.languageCode, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                    {locales[locale].flag} {locale.toUpperCase()}
                  </Text>
                )}
                <Ionicons 
                  name="chevron-forward" 
                  size={18} 
                  color={colors.surface[400]} 
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            borderColor: colors.red[500],
          }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.red[500]} />
          <Text style={styles.logoutText}>{t.auth.logout}</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={[styles.version, { color: isDark ? colors.surface[500] : colors.surface[400] }]}>
          Kiwi Driver v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  profileCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.kiwi[500],
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileStat: {
    alignItems: 'center',
    flex: 1,
  },
  profileStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  profileStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  profileStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  menuCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    ...shadows.soft,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[100],
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  languageCode: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.red[500],
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
  },
});
