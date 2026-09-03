import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { colors, gradients, shadows } from '../utils/theme';
import { api, Schedule } from '../services/api';

const DAYS = [
  { key: 0, label: 'Domingo', short: 'Dom' },
  { key: 1, label: 'Lunes', short: 'Lun' },
  { key: 2, label: 'Martes', short: 'Mar' },
  { key: 3, label: 'Miércoles', short: 'Mié' },
  { key: 4, label: 'Jueves', short: 'Jue' },
  { key: 5, label: 'Viernes', short: 'Vie' },
  { key: 6, label: 'Sábado', short: 'Sáb' },
];

const TIME_OPTIONS = [];
for (let h = 5; h <= 23; h++) {
  TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 23) TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:30`);
}

export default function ScheduleScreen() {
  const { isDark } = useTheme();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const data = await api.getSchedule();
      setSchedules(data || []);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSchedule();
    setRefreshing(false);
  };

  const getScheduleForDay = (dayOfWeek: number) => {
    return schedules.find(s => s.dayOfWeek === dayOfWeek);
  };

  const toggleDay = async (dayOfWeek: number) => {
    const existing = getScheduleForDay(dayOfWeek);
    const updated = schedules.map(s => {
      if (s.dayOfWeek === dayOfWeek) {
        return { ...s, isAvailable: !s.isAvailable };
      }
      return s;
    });

    // If no schedule exists for this day, create one
    if (!existing) {
      updated.push({
        id: `temp-${dayOfWeek}`,
        driverId: '',
        dayOfWeek,
        startTime: '08:00',
        endTime: '17:00',
        isAvailable: true,
      });
    }

    setSchedules(updated);
  };

  const updateStartTime = (dayOfWeek: number, time: string) => {
    setSchedules(prev => prev.map(s => {
      if (s.dayOfWeek === dayOfWeek) {
        return { ...s, startTime: time };
      }
      return s;
    }));
  };

  const updateEndTime = (dayOfWeek: number, time: string) => {
    setSchedules(prev => prev.map(s => {
      if (s.dayOfWeek === dayOfWeek) {
        return { ...s, endTime: time };
      }
      return s;
    }));
  };

  const saveSchedule = async () => {
    try {
      setSaving(true);
      const scheduleData = schedules.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isAvailable: s.isAvailable,
      }));
      await api.updateSchedule(scheduleData);
      Alert.alert('Check Horario guardado', 'Tu horario ha sido actualizado');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo guardar el horario');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.surface[950] : colors.surface[50] }]>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.kiwi[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
    }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.kiwi[500]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Mi Horario
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
            Configura tus días y horas de trabajo
          </Text>
        </View>

        {/* Days */}
        {DAYS.map((day) => {
          const schedule = getScheduleForDay(day.key);
          const isAvailable = schedule?.isAvailable ?? false;

          return (
            <View key={day.key} style={[styles.dayCard, { 
              backgroundColor: isDark ? colors.surface[800] : '#fff',
              opacity: isAvailable ? 1 : 0.6,
            }, shadows.soft]}>
              <View style={styles.dayHeader}>
                <View style={styles.dayInfo}>
                  <Text style={[styles.dayName, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                    {day.label}
                  </Text>
                  {isAvailable && (
                    <Text style={[styles.dayTime, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                      {schedule?.startTime || '08:00'} - {schedule?.endTime || '17:00'}
                    </Text>
                  )}
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={() => toggleDay(day.key)}
                  trackColor={{ false: colors.surface[300], true: colors.kiwi[300] }}
                  thumbColor={isAvailable ? colors.kiwi[500] : colors.surface[400]}
                />
              </View>

              {isAvailable && (
                <View style={styles.timeContainer}>
                  <View style={styles.timeGroup}>
                    <Text style={[styles.timeLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                      Inicio
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
                      {TIME_OPTIONS.map((time) => (
                        <TouchableOpacity
                          key={`start-${time}`}
                          style={[
                            styles.timeOption,
                            schedule?.startTime === time && styles.timeOptionActive,
                          ]}
                          onPress={() => updateStartTime(day.key, time)}
                        >
                          <Text style={[
                            styles.timeOptionText,
                            schedule?.startTime === time && styles.timeOptionTextActive,
                          ]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.timeGroup}>
                    <Text style={[styles.timeLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                      Fin
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
                      {TIME_OPTIONS.map((time) => (
                        <TouchableOpacity
                          key={`end-${time}`}
                          style={[
                            styles.timeOption,
                            schedule?.endTime === time && styles.timeOptionActive,
                          ]}
                          onPress={() => updateEndTime(day.key, time)}
                        >
                          <Text style={[
                            styles.timeOptionText,
                            schedule?.endTime === time && styles.timeOptionTextActive,
                          ]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveSchedule}
          disabled={saving}
        >
          <LinearGradient colors={gradients.kiwi} style={styles.saveGradient}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveText}>Guardar horario</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  dayCard: { borderRadius: 16, padding: 16, marginBottom: 10 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayInfo: { flex: 1 },
  dayName: { fontSize: 16, fontWeight: '700' },
  dayTime: { fontSize: 13, marginTop: 2 },
  timeContainer: { marginTop: 12, gap: 12 },
  timeGroup: {},
  timeLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  timeScroll: { flexDirection: 'row' },
  timeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginRight: 8,
  },
  timeOptionActive: {
    backgroundColor: colors.kiwi[500],
  },
  timeOptionText: { fontSize: 13, color: colors.surface[600] },
  timeOptionTextActive: { color: '#fff', fontWeight: '700' },
  saveButton: { borderRadius: 12, overflow: 'hidden', marginTop: 10 },
  saveButtonDisabled: { opacity: 0.6 },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
