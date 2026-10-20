import { useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { menuApi, type MenuItemInput } from '../../src/api/menu';
import { http } from '../../src/api/client';
import { BottomNav } from '../../src/ui/BottomNav';

const api = menuApi(http);

const inputStyle = {
  backgroundColor: tokens.color.surface,
  color: tokens.color.ink,
  borderRadius: tokens.radius.md,
  padding: 12,
  marginBottom: tokens.space[2],
} as const;

const EMPTY: MenuItemInput = {
  name: '',
  description: '',
  price: 0,
  category: '',
  isAvailable: true,
  stockQty: null,
};

export default function Menu() {
  const { t, translate } = useTranslation();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MenuItemInput>(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const { data, isRefetching, refetch, isPending, isError } = useQuery({
    queryKey: ['menu', 'my'],
    queryFn: () => api.items(),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['menu', 'my'] });

  const save = useMutation({
    mutationFn: () =>
      editingId
        ? api.update(editingId, form)
        : api.create({ ...form, price: Number(form.price) || 0 }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY);
    },
    onError: () => Alert.alert(t.merchantMenu.saveFailed),
  });

  const toggle = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => api.setAvailable(id, value),
    onSuccess: invalidate,
    onError: () => Alert.alert(t.merchantMenu.saveFailed),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: invalidate,
    onError: () => Alert.alert(t.merchantMenu.deleteFailed),
  });

  const items = Array.isArray(data) ? data : [];

  const startEdit = (it: any) => {
    setEditingId(it.id);
    setForm({
      name: it.name ?? '',
      description: it.description ?? '',
      price: Number(it.price ?? 0),
      category: it.category ?? '',
      isAvailable: it.isAvailable !== false,
      stockQty: it.stockQty ?? null,
    });
    setShowForm(true);
  };

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.space[3],
        }}
      >
        <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
          {t.merchantMenu.title}
        </Text>
        <Button
          label={t.merchantMenu.add}
          onPress={() => {
            setEditingId(null);
            setForm(EMPTY);
            setShowForm((v) => !v);
          }}
        />
      </View>

      {showForm && (
        <View
          style={{
            backgroundColor: tokens.color.surface,
            borderRadius: tokens.radius.lg,
            padding: tokens.space[4],
            marginBottom: tokens.space[3],
          }}
        >
          <Text style={{ color: tokens.color.ink, fontWeight: '700', marginBottom: 8 }}>
            {editingId ? t.merchantMenu.edit : t.merchantMenu.add}
          </Text>
          <TextInput
            placeholder={t.merchantMenu.name}
            placeholderTextColor={tokens.color.muted}
            value={form.name}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            style={inputStyle}
          />
          <TextInput
            placeholder={t.merchantMenu.description}
            placeholderTextColor={tokens.color.muted}
            value={form.description ?? ''}
            onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
            style={inputStyle}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder={t.merchantMenu.price}
              placeholderTextColor={tokens.color.muted}
              value={String(form.price || '')}
              onChangeText={(v) =>
                setForm((f) => ({ ...f, price: Number(v.replace(/[^0-9]/g, '')) || 0 }))
              }
              keyboardType="numeric"
              style={[inputStyle, { flex: 1 }]}
            />
            <TextInput
              placeholder={t.merchantMenu.category}
              placeholderTextColor={tokens.color.muted}
              value={form.category ?? ''}
              onChangeText={(v) => setForm((f) => ({ ...f, category: v }))}
              style={[inputStyle, { flex: 1 }]}
            />
          </View>
          <TextInput
            placeholder={t.merchantMenu.stock}
            placeholderTextColor={tokens.color.muted}
            value={form.stockQty == null ? '' : String(form.stockQty)}
            onChangeText={(v) =>
              setForm((f) => ({
                ...f,
                stockQty: v.trim() === '' ? null : Number(v.replace(/[^0-9]/g, '')) || 0,
              }))
            }
            keyboardType="numeric"
            style={inputStyle}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text style={{ color: tokens.color.ink }}>{t.merchantMenu.available}</Text>
            <Switch
              value={form.isAvailable !== false}
              onValueChange={(v) => setForm((f) => ({ ...f, isAvailable: v }))}
            />
          </View>
          <Button
            label={save.isPending ? t.merchantMenu.saving : t.merchantMenu.save}
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tokens.space[6] }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
      >
        {isPending ? (
          <Text style={{ color: tokens.color.muted }}>…</Text>
        ) : isError ? (
          <Text style={{ color: tokens.color.muted }}>{t.merchantMenu.loadFailed}</Text>
        ) : items.length === 0 ? (
          <Text style={{ color: tokens.color.muted }}>{t.merchantMenu.empty}</Text>
        ) : (
          items.map((it: any) => (
            <View
              key={it.id}
              style={{
                backgroundColor: tokens.color.surface,
                borderRadius: tokens.radius.lg,
                padding: tokens.space[4],
                marginBottom: tokens.space[3],
                opacity: it.isAvailable === false ? 0.6 : 1,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: tokens.color.ink, fontWeight: '700', flex: 1 }}>
                  {it.name}
                </Text>
                <Switch
                  value={it.isAvailable !== false}
                  onValueChange={(v) => toggle.mutate({ id: it.id, value: v })}
                />
              </View>
              <Text style={{ color: tokens.color.muted, marginTop: 2 }}>
                ₡{Number(it.price ?? 0).toLocaleString()}
                {it.category ? ` · ${it.category}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable
                  onPress={() => startEdit(it)}
                  style={{ paddingVertical: 6, paddingHorizontal: 4 }}
                >
                  <Text style={{ color: tokens.color.kiwi, fontWeight: '600' }}>
                    {t.merchantMenu.edit}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      t.merchantMenu.delete,
                      translate('merchantMenu.confirmDelete', { name: it.name ?? '' }),
                      [
                        { text: t.merchantMenu.cancel, style: 'cancel' },
                        {
                          text: t.merchantMenu.delete,
                          style: 'destructive',
                          onPress: () => remove.mutate(it.id),
                        },
                      ],
                    )
                  }
                  style={{ paddingVertical: 6, paddingHorizontal: 4 }}
                >
                  <Text style={{ color: '#ef4444', fontWeight: '600' }}>
                    {t.merchantMenu.delete}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <BottomNav active="menu" />
    </Screen>
  );
}
