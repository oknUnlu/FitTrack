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
import { useLanguage } from '../../i18n';
import { usePremiumStore } from '../../store/premiumStore';
import { PaywallModal } from '../../components/PaywallModal';

export function SocialScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [templateDialogVisible, setTemplateDialogVisible] = useState(false);
  const [updateDialogVisible, setUpdateDialogVisible] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [updateValue, setUpdateValue] = useState('');
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const isPremium = usePremiumStore((s) => s.isPremium);
  const FREE_CHALLENGE_LIMIT = 1;

  const loadData = useCallback(async () => {
    const data = await getChallenges();
    setChallenges(data);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const active = getActiveChallenges(challenges);
  const completed = getCompletedChallenges(challenges);

  const handleAddFromTemplate = async (template: typeof CHALLENGE_TEMPLATES[0]) => {
    // Check free limit before adding
    if (!isPremium && active.length >= FREE_CHALLENGE_LIMIT) {
      setTemplateDialogVisible(false);
      setPaywallVisible(true);
      return;
    }

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
    Alert.alert(t.social.deleteTitle, t.social.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: async () => { await removeChallenge(id); loadData(); } },
    ]);
  };

  const handleShare = async (challenge: Challenge) => {
    const progress = Math.round((challenge.currentValue / challenge.targetValue) * 100);
    const text = `🏆 FitTrack Challenge\n\n${challenge.title}\n${challenge.description}\n\nİlerleme: ${challenge.currentValue}/${challenge.targetValue} ${challenge.unit} (${progress}%)\n${challenge.isCompleted ? '✅ Tamamlandı!' : '🔥 Devam ediyor...'}\n\n#FitTrack #Challenge`;
    try {
      await Share.share({ message: text });
    } catch (e) {
      if (__DEV__) console.warn('Share failed:', e);
    }
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Button mode="contained" onPress={() => {
            if (!isPremium && active.length >= FREE_CHALLENGE_LIMIT) {
              setPaywallVisible(true);
              return;
            }
            setTemplateDialogVisible(true);
          }} icon="plus" compact>
            {t.social.new}
          </Button>
          {!isPremium && active.length >= FREE_CHALLENGE_LIMIT && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, gap: 4 }}>
              <MaterialCommunityIcons name="lock" size={12} color="#FFD700" />
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#FFD700' }}>PRO</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Summary */}
      <Card style={[styles.card, { backgroundColor: colors.successBg }]} mode="elevated">
        <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>{active.length}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t.social.activeLabel}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.orange }}>{completed.length}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t.social.completed}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.secondary }}>{challenges.length}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t.social.total}</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Tab Selector */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>{t.social.activeLabel} ({active.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'completed' && styles.tabBtnActive]}
          onPress={() => setTab('completed')}
        >
          <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>{t.social.completed} ({completed.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Challenge List */}
      {displayChallenges.length === 0 ? (
        <Card style={styles.card} mode="elevated">
          <Card.Content style={{ alignItems: 'center', padding: spacing.lg }}>
            <MaterialCommunityIcons name="trophy-outline" size={48} color={colors.textDisabled} />
            <Text style={{ color: colors.textTertiary, marginTop: 8 }}>
              {tab === 'active' ? t.social.noActive : t.social.noCompleted}
            </Text>
            {tab === 'active' && (
              <Button mode="outlined" onPress={() => setTemplateDialogVisible(true)} style={{ marginTop: 12 }}>
                {t.social.startChallenge}
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
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{ch.description}</Text>
                  </View>
                  {ch.isCompleted && (
                    <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                  )}
                </View>

                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
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
                      {t.social.update}
                    </Button>
                  )}
                  <Button mode="text" compact onPress={() => handleShare(ch)} icon="share">
                    {t.social.share}
                  </Button>
                  <Button mode="text" compact onPress={() => handleRemove(ch.id)} icon="delete" textColor="#F44336">
                    {t.common.delete}
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature="challenges" />

      {/* Template Dialog */}
      <Portal>
        <Dialog visible={templateDialogVisible} onDismiss={() => setTemplateDialogVisible(false)}>
          <Dialog.Title>{t.social.selectChallenge}</Dialog.Title>
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
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{tmpl.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setTemplateDialogVisible(false)}>{t.common.cancel}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Update Dialog */}
      <Portal>
        <Dialog visible={updateDialogVisible} onDismiss={() => setUpdateDialogVisible(false)}>
          <Dialog.Title>{t.social.updateProgress}</Dialog.Title>
          <Dialog.Content>
            {selectedChallenge && (
              <>
                <Text style={{ marginBottom: 8, color: colors.textSecondary }}>
                  {selectedChallenge.title} - {selectedChallenge.targetValue} {selectedChallenge.unit}
                </Text>
                <TextInput
                  label={`${t.social.currentValue} (${selectedChallenge.unit})`}
                  value={updateValue}
                  onChangeText={setUpdateValue}
                  keyboardType="numeric"
                  mode="outlined"
                  dense
                  style={{ backgroundColor: colors.textOnPrimary }}
                />
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUpdateDialogVisible(false)}>{t.common.cancel}</Button>
            <Button onPress={handleUpdate} disabled={!updateValue.trim() || isNaN(parseFloat(updateValue))}>{t.social.update}</Button>
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
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: borderRadius.md, backgroundColor: colors.divider, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.textOnPrimary },
  challengeCard: { borderRadius: borderRadius.md, marginBottom: 8 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
});
