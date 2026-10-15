import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Price, QtyStepper, Screen, tokens } from '@kiwi/mobile-ui';
import { menuApi } from '../../../src/api/menu';
import { http } from '../../../src/api/http';
import { unitPriceFor, type SelectedOption } from '../../../src/cart/math';
import { useCart, cartStore } from '../../../src/cart/useCart';
import { Card, Header, Pill, ui } from '../../../src/components/ui';

const api = menuApi(http);

interface VariantOption {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable?: boolean;
}
interface VariantGroup {
  id: string;
  name: string;
  required?: boolean;
  multiple?: boolean;
  maxSelections?: number | null;
  options: VariantOption[];
}
interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  isPopular?: boolean;
  stockQty?: number | null;
  offeredTomorrow?: boolean;
  variantGroups?: VariantGroup[];
}

function lineIdFor(itemId: string, selected: SelectedOption[]): string {
  const opts = selected
    .map((s) => s.optionId)
    .sort()
    .join(',');
  return `${itemId}:${opts}`;
}

export default function Menu() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [category, setCategory] = useState<string>('Todos');
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [pickError, setPickError] = useState<string | null>(null);

  const lines = useCart((s) => s.lines);

  const profileQuery = useQuery({
    queryKey: ['menu-profile', id],
    queryFn: () => api.publicProfile(id),
    enabled: !!id,
  });

  const itemsQuery = useQuery({
    queryKey: ['menu-items', id],
    queryFn: () => api.items(id),
    enabled: !!id,
  });

  const items: MenuItem[] = useMemo(() => {
    const raw = itemsQuery.data?.items;
    return Array.isArray(raw) ? raw : [];
  }, [itemsQuery.data]);

  const categories: string[] = useMemo(() => {
    const raw = itemsQuery.data?.categories;
    return Array.isArray(raw) && raw.length > 0 ? raw : ['Todos'];
  }, [itemsQuery.data]);

  const visible = useMemo(() => {
    const today = items.filter((i) => !i.offeredTomorrow);
    return category === 'Todos' ? today : today.filter((i) => i.category === category);
  }, [items, category]);

  const tomorrow = useMemo(
    () => (category === 'Todos' ? items.filter((i) => i.offeredTomorrow) : []),
    [items, category],
  );

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [lines],
  );

  const countInCart = (itemId: string) =>
    lines.filter((l) => l.menuItemId === itemId).reduce((s, l) => s + l.quantity, 0);

  const addLine = (item: MenuItem, selected: SelectedOption[]) => {
    const stock = item.stockQty;
    if (typeof stock === 'number' && countInCart(item.id) >= stock) return;
    cartStore.getState().add({
      lineId: lineIdFor(item.id, selected),
      menuItemId: item.id,
      name: item.name,
      unitPrice: unitPriceFor(Number(item.price), selected),
      quantity: 1,
      selectedOptions: selected,
    });
  };

  const onAdd = (item: MenuItem) => {
    const groups = item.variantGroups ?? [];
    const hasOptions = groups.some((g) => g.options.length > 0);
    if (!hasOptions) {
      addLine(item, []);
      return;
    }
    const initial: Record<string, string[]> = {};
    for (const g of groups) {
      const first = g.options.find((o) => o.isAvailable !== false);
      if (g.required && !g.multiple && first) initial[g.id] = [first.id];
    }
    setPicks(initial);
    setPickError(null);
    setPicking(item);
  };

  const togglePick = (g: VariantGroup, optionId: string) => {
    setPicks((prev) => {
      const current = prev[g.id] ?? [];
      if (g.multiple) {
        if (current.includes(optionId))
          return { ...prev, [g.id]: current.filter((x) => x !== optionId) };
        if (typeof g.maxSelections === 'number' && current.length >= g.maxSelections) return prev;
        return { ...prev, [g.id]: [...current, optionId] };
      }
      return { ...prev, [g.id]: [optionId] };
    });
  };

  const confirmPick = () => {
    if (!picking) return;
    const groups = picking.variantGroups ?? [];
    const missing = groups.find((g) => g.required && (picks[g.id] ?? []).length === 0);
    if (missing) {
      setPickError(`Elegí una opción de "${missing.name}"`);
      return;
    }
    const selected: SelectedOption[] = [];
    for (const g of groups) {
      for (const optionId of picks[g.id] ?? []) {
        const opt = g.options.find((o) => o.id === optionId);
        if (opt) selected.push({ optionId: opt.id, price: Number(opt.priceDelta) });
      }
    }
    addLine(picking, selected);
    setPicking(null);
    setPicks({});
  };

  const builder = items.find((i) => i.name.toLowerCase().includes('crea tu bowl'));

  if (itemsQuery.isLoading || profileQuery.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={tokens.color.kiwi} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={profileQuery.data?.businessName ?? 'Menú'} />

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {!!profileQuery.data?.description && (
          <Text style={[ui.muted, { marginBottom: 12 }]}>{profileQuery.data.description}</Text>
        )}

        {builder && (
          <Pressable onPress={() => onAdd(builder)}>
            <Card style={styles.hero}>
              <Text style={{ color: tokens.color.ink, fontSize: 16, fontWeight: '700' }}>
                🥣 {builder.name}
              </Text>
              <Text style={[ui.muted, { marginTop: 4 }]}>Armá tu bowl eligiendo tus toppings.</Text>
            </Card>
          </Pressable>
        )}

        <View style={styles.pillRow}>
          {categories.map((c) => (
            <Pill key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>

        {visible.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            inCart={countInCart(item.id)}
            onAdd={() => onAdd(item)}
          />
        ))}

        {tomorrow.length > 0 && (
          <>
            <Text style={[ui.sectionTitle, { marginTop: 20 }]}>Mañana en preventa</Text>
            <Text style={[ui.muted, { marginBottom: 8 }]}>
              Pedí hoy y programá la entrega para mañana.
            </Text>
            {tomorrow.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                inCart={countInCart(item.id)}
                onAdd={() => onAdd(item)}
              />
            ))}
          </>
        )}

        {lines.length > 0 && (
          <Card style={{ marginTop: 20 }}>
            <Text style={ui.sectionTitle}>Tu pedido</Text>
            {lines.map((line) => (
              <View key={line.lineId} style={styles.cartLine}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tokens.color.ink, fontWeight: '600' }}>{line.name}</Text>
                  <QtyStepper
                    value={line.quantity}
                    min={0}
                    onChange={(n) =>
                      n <= 0
                        ? cartStore.getState().remove(line.lineId)
                        : cartStore.getState().setQty(line.lineId, n)
                    }
                  />
                </View>
                <Price amount={line.unitPrice * line.quantity} />
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {lines.length > 0 && (
        <View style={styles.cartBar}>
          <View>
            <Text style={ui.muted}>Total</Text>
            <Price amount={subtotal} />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Button
              label="Ir al checkout"
              onPress={() =>
                router.push({
                  pathname: '/(public)/checkout',
                  params: {
                    merchantId: id,
                    merchantName: profileQuery.data?.businessName ?? '',
                    pickupAddress: profileQuery.data?.address ?? '',
                    isHomeCook: profileQuery.data?.isHomeCook ? '1' : '0',
                  },
                })
              }
            />
          </View>
        </View>
      )}

      <Modal
        visible={!!picking}
        transparent
        animationType="slide"
        onRequestClose={() => setPicking(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[ui.sectionTitle, { fontSize: 18 }]}>{picking?.name}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {(picking?.variantGroups ?? []).map((g) => (
                <View key={g.id} style={{ marginBottom: 16 }}>
                  <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>
                    {g.name}
                    {typeof g.maxSelections === 'number' ? ` (máx ${g.maxSelections})` : ''}
                  </Text>
                  {g.options.map((o) => {
                    const active = (picks[g.id] ?? []).includes(o.id);
                    const disabled = o.isAvailable === false;
                    return (
                      <Pressable
                        key={o.id}
                        disabled={disabled}
                        onPress={() => togglePick(g, o.id)}
                        style={[
                          styles.option,
                          active ? styles.optionActive : null,
                          disabled ? { opacity: 0.4 } : null,
                        ]}
                      >
                        <Text style={{ color: tokens.color.ink }}>
                          {active ? '◉' : '○'} {o.name}
                        </Text>
                        {Number(o.priceDelta) > 0 && (
                          <Text style={ui.muted}>
                            +₡{Number(o.priceDelta).toLocaleString('es-CR')}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            {!!pickError && (
              <Text style={{ color: tokens.color.danger, marginBottom: 8 }}>{pickError}</Text>
            )}
            <Button label="Agregar" onPress={confirmPick} />
            <Pressable onPress={() => setPicking(null)} style={{ marginTop: 12 }}>
              <Text style={[ui.muted, { textAlign: 'center' }]}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ItemRow({ item, inCart, onAdd }: { item: MenuItem; inCart: number; onAdd: () => void }) {
  const hasOptions = (item.variantGroups ?? []).some((g) => g.options.length > 0);
  const soldOut = typeof item.stockQty === 'number' && item.stockQty <= 0;
  const atStock = typeof item.stockQty === 'number' && inCart >= item.stockQty;

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: tokens.color.ink, fontSize: 15, fontWeight: '700' }}>
            {item.name}
          </Text>
          {!!item.description && (
            <Text style={[ui.muted, { marginTop: 4 }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={[ui.row, { marginTop: 6 }]}>
            <Price amount={Number(item.price)} />
            {typeof item.stockQty === 'number' && item.stockQty > 0 && item.stockQty <= 10 && (
              <Text style={[ui.muted, { marginLeft: 10 }]}>Quedan {item.stockQty}</Text>
            )}
          </View>
          {!!chosenLabelHint(item, inCart) && (
            <Text style={ui.muted}>{chosenLabelHint(item, inCart)}</Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`agregar ${item.name}`}
          disabled={soldOut || atStock}
          onPress={onAdd}
          style={[styles.addBtn, soldOut || atStock ? { opacity: 0.4 } : null]}
        >
          <Text style={{ color: '#04140a', fontSize: 22, fontWeight: '800' }}>
            {hasOptions ? '…' : '+'}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

function chosenLabelHint(item: MenuItem, inCart: number): string {
  if (item.offeredTomorrow) return 'Preventa · mañana';
  if (inCart > 0) return `${inCart} en el carrito`;
  return '';
}

const styles = {
  hero: { marginBottom: 16, borderColor: tokens.color.kiwi },
  pillRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginBottom: 12 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.kiwi,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cartLine: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  cartBar: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    backgroundColor: tokens.color.canvas,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end' as const,
  },
  modalCard: {
    backgroundColor: tokens.color.canvas,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    padding: 20,
  },
  option: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  optionActive: {},
};
