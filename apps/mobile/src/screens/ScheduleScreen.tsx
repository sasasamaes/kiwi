import React, { useState, useEffect } from 'react';
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
import { useTheme } from '../hooks/useTheme';
import { colors, shadows } from '../utils/theme';
import { api } from '../services/api';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am - 8pm

export default function ScheduleScreen() {
  const { isDark } = useTheme();
  const [schedule, setSchedule] = useState<Record<number, number[]>>({});
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const data = await api.getSchedule();
      setSchedule(data.schedule || {});
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    }
  };

  const toggleHour = (day: number, hour: number) => {
    const daySchedule = schedule[day] || [];
    const newSchedule = { ...schedule };
    
    if (daySchedule.includes(hour)) {
      newSchedule[day] = daySchedule.filter(h => h !== hour);
    } else {
      newSchedule[day] = [...daySchedule, hour].sort((a, b) => a - b);
    }
    
    setSchedule(newSchedule);
  };

  const saveSchedule = async () => {
    setLoading(true);
    try {
      await api.updateSchedule({ schedule });
      Alert.alert('Éxito', 'Horario actualizado');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el horario');
    } finally {
      setLoading(false);
    }
  };

  const getDayHours = (day: number) => {
    return schedule[day] || [];
  };

  const getTotalHours = () => {
    return Object.values(schedule).reduce((total, hours) => total + hours.length, 0);
  };

  return (
    <SafeAreaView style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
    }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Mi Horario
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
            {getTotalHours()} horas esta semana
          </Text>
        </View>

        {/* Days */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysContainer}
        >
          {DAYS.map((day, index) => {
            const hours = getDayHours(index);
            const isSelected = selectedDay === index;
            
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, isSelected && styles.dayButtonActive]}
                onPress={() => setSelectedDay(index)}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>
                  {day}
                </Text>
                {hours.length > 0 && (
                  <View style={[styles.hoursBadge, isSelected && styles.hoursBadgeActive]}>
                    <Text style={[styles.hoursText, isSelected && styles.hoursTextActive]}>
                      {hours.length}h
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Hours Grid */}
        <View style={[styles.hoursCard, { 
          backgroundColor: isDark ? colors.surface[800] : '#fff' 
        }, shadows.soft]}>
          <Text style={[styles.hoursTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Horas disponibles - {DAYS[selectedDay]}
          </Text>
          
          <View style={styles.hoursGrid}>
            {HOURS.map((hour) => {
              const isSelected = getDayHours(selectedDay).includes(hour);
              
              return (
                <TouchableOpacity
                  key={hour}
                  style={[styles.hourButton, isSelected && styles.hourButtonActive]}
                  onPress={() => toggleHour(selectedDay, hour)}
                >
                  <Text style={[styles.hourText, isSelected && styles.hourTextActive]}>
                    {hour}:00
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Quick Presets */}
        <View style={styles.presetsContainer}>
          <Text style={[styles.presetsTitle, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
            Atajos rápidos
          </Text>
          <View style={styles.presetsRow}>
            {[
              { label: '🌅 Mañana', hours: [7, 8, 9, 10, 11, 12] },
              { label: '☀️ Tarde', hours: [13, 14, 15, 16, 17, 18] },
              { label: '🌙 Noche', hours: [18, 19, 20] },
              { label: '📅 Todo', hours: HOURS },
            ].map((preset) => (
              <TouchableOpacity
                key={preset.label}
                style={[styles.presetButton, { 
                  backgroundColor: isDark ? colors.surface[800] : '#fff' 
                }]}
                onPress={() => {
                  setSchedule({ ...schedule, [selectedDay]: preset.hours });
                }}
              >
                <Text style={[styles.presetText, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={saveSchedule}
          disabled={loading}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.saveText}>
            {loading ? 'Guardando...' : 'Guardar Horario'}
          </Text>
        </TouchableOpacity>
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
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  daysContainer: {
    gap: 12,
    marginBottom: 24,
  },
  dayButton: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.surface[100],
    minWidth: 60,
  },
  dayButtonActive: {
    backgroundColor: colors.kiwi[500],
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface[600],
  },
  dayTextActive: {
    color: '#fff',
  },
  hoursBadge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.kiwi[100],
  },
  hoursBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  hoursText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.kiwi[700],
  },
  hoursTextActive: {
    color: '#fff',
  },
  hoursCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    ...shadows.soft,
  },
  hoursTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  hoursGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hourButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surface[100],
    minWidth: 70,
    alignItems: 'center',
  },
  hourButtonActive: {
    backgroundColor: colors.kiwi[500],
  },
  hourText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface[600],
  },
  hourTextActive: {
    color: '#fff',
  },
  presetsContainer: {
    marginBottom: 24,
  },
  presetsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    ...shadows.soft,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: colors.kiwi[500],
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
