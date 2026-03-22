import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Share } from 'react-native';
import { Text, Card, useTheme, Button, Portal, Dialog, TextInput, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getChallenges,
  addChallenge,
  removeChallenge,
  updateChallengeProgress,
  getActiveChallenges,
  getCompletedChallenges,
  Challenge,
  CHALLENGE_TEMPLATES,
} from '../../services/social/challengeService';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { generateId, todayString } from '../../utils/helpers';

export function SocialScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [templateDialogVisible, setTemplateDialogVisible] = useState(false);
  const [updateDialogVisible, setUpdateDialogVisible] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [updateValue, setUpdateValue] = useState('');
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  const loadData = useCallback(async () => {
    const data = await getChallenges();
    setChallenges(data);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const active = getActiveChallenges(challenges);
  const completed = getCompletedChallenges(challenges);

  const handleAddFromTemplate = async (template: typeof CHALLENGE_TEMPLATES[0]) => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7);

    const newChallenge: Challenge = {
      ...template,
      id: generateId(),
      startDate: today.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      currentValue: 0,
      isCompleted: false,
    };

    await addChallenge(newChallenge);
    setTemplateDialogVisible(false);
    loadData();
  };

  const handleUpdate = async () => {
    if (!selectedChallenge) return;
    const val = parseFloat(updateValue);
    if (isNaN(val) || val < 0) return;
    await updateChallengeProgress(selectedChallenge.id, val);
    setUpdateDialogVisible(false);
    setSelectedChallenge(null);
    setUpdateValue('');
    loadData();
  };

  const handleRemove = async (id: string) => {
    Alert.alert('Sil', 'Bu challenge\'ı silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => { await removeChallenge(id); loadData(); } },
    ]);
  };

  const handleShare = async (challenge: Challenge) => {
    const progress = Math.round((challenge.currentValue / challenge.targetValue) * 100);
    const text = `🏆 FitTrack Challenge\n\n${challenge.title}\n${challenge.description}\n\nİlerleme: ${challenge.currentValue}/${challenge.targetValue} ${challenge.unit} (${progress}%)\n${challenge.isCompleted ? '✅ Tamamlandı!' : '🔥 Devam ediyor...'}\n\n#FitTrack #Challenge`;
    try {
      await Share.share({ message: text });
    } catch {}
  };

  const openUpdateDialog = (ch: Challenge) => {
    setSelectedChallenge(ch);
    setUpdateValue(ch.currentValue.toString());
    setUpdateDialogVisible(true);
  };

  const displayChallenges = tab === 'active' ? active : completed;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.md, paddingBottom: 40 }}
    >
      <View style={styles.headerRow}>
        <Text variant="headlineSmall" style={styles.title}>Challenges</Text>
        <Button mode="contained" onPress={() => setTemplateDialogVisible(true)} icon="plus" compact>
          Yeni
        </Button>
      </View>

      {/* Stats Summary */}
      <Card style={[styles.card, { backgroundColor: '#E8F5E9' }]} mode="elevated">
        <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#4CAF50' }}>{active.length}</Text>
            <Text style={{ color: '#666', fontSize: 12 }}>Aktif</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FF9800' }}>{completed.length}</Text>
            <Text style={{ color: '#666', fontSize: 12 }}>Tamamlanan</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2196F3' }}>{challenges.length}</Text>
            <Text style={{ color: '#666', fontSize: 12 }}>Toplam</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Tab Selector */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>Aktif ({active.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'completed' && styles.tabBtnActive]}
          onPress={() => setTab('completed')}
        >
          <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>Tamamlanan ({completed.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Challenge List */}
      {displayChallenges.length === 0 ? (
        <Card style={styles.card} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="trophy-outline" size={48} color="#ccc" />
            <Text style={{ color: '#999', marginTop: 8 }}>
              {tab === 'active' ? 'Aktif challenge yok' : 'Tamamlanmış challenge yok'}
            </Text>
            {tab === 'active' && (
              <Button mode="outlined" onPress={() => setTemplateDialogVisible(true)} style={{ marginTop: 12 }}>
                Challenge Başlat
              </Button>
            )}
          </Card.Content>
        </Card>
      ) : (
        displayChallenges.map((ch) => {
          const progress = ch.targetValue > 0 ? Math.min(ch.currentValue / ch.targetValue, 1) : 0;
          return (
            <Card key={ch.id} style={styles.challengeCard} mode="elevated">
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.iconCircle, { backgroundColor: ch.color + '20' }]}>
                    <MaterialCommunityIcons name={ch.icon as any} size={24} color={ch.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{ch.title}</Text>
                    <Text style={{ color: '#999', fontSize: 12 }}>{ch.description}</Text>
                  </View>
                  {ch.isCompleted && (
                    <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                  )}
                </View>

                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#666' }}>
                      {ch.currentValue} / {ch.targetValue} {ch.unit}
                    </Text>
                    <Text style={{ fontSize: 12, color: ch.color, fontWeight: 'bold' }}>
                      {Math.round(progress * 100)}%
                    </Text>
                  </View>
                  <ProgressBar progress={progress} color={ch.color} style={{ height: 6, borderRadius: 3 }} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 4 }}>
                  {!ch.isCompleted && (
                    <Button mode="text" compact onPress={() => openUpdateDialog(ch)} icon="pencil">
                      Güncelle
                    </Button>
                  )}
                  <Button mode="text" compact onPress={() => handleShare(ch)} icon="share">
                    Paylaş
                  </Button>
                  <Button mode="text" compact onPress={() => handleRemove(ch.id)} icon="delete" textColor="#F44336">
                    Sil
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}

      {/* Template Dialog */}
      <Portal>
        <Dialog visible={templateDialogVisible} onDismiss={() => setTemplateDialogVisible(false)}>
          <Dialog.Title>Challenge Seç</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
              {CHALLENGE_TEMPLATES.map((tmpl, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleAddFromTemplate(tmpl)}
                  activeOpacity={0.7}
                  style={styles.templateItem}
                >
                  <MaterialCommunityIcons name={tmpl.icon as any} size={28} color={tmpl.color} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontWeight: 'bold' }}>{tmpl.title}</Text>
                    <Text style={{ color: '#999', fontSize: 12 }}>{tmpl.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setTemplateDialogVisible(false)}>İptal</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Update Dialog */}
      <Portal>
        <Dialog visible={updateDialogVisible} onDismiss={() => setUpdateDialogVisible(false)}>
          <Dialog.Title>İlerleme Güncelle</Dialog.Title>
          <Dialog.Content>
            {selectedChallenge && (
              <>
                <Text style={{ marginBottom: 8, color: '#666' }}>
                  {selectedChallenge.title} - Hedef: {selectedChallenge.targetValue} {selectedChallenge.unit}
                </Text>
                <TextInput
                  label={`Mevcut değer (${selectedChallenge.unit})`}
                  value={updateValue}
                  onChangeText={setUpdateValue}
                  keyboardType="numeric"
                  mode="outlined"
                  dense
                  style={{ backgroundColor: '#fff' }}
                />
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUpdateDialogVisible(false)}>İptal</Button>
            <Button onPress={handleUpdate}>Güncelle</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontWeight: 'bold' },
  card: { borderRadius: borderRadius.lg, marginBottom: spacing.md },
  tabRow: { flexDirection: 'row', marginBottom: spacing.md, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: borderRadius.md, backgroundColor: '#F0F0F0', alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#fff' },
  challengeCard: { borderRadius: borderRadius.md, marginBottom: 8 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
});
