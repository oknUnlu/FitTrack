import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput, IconButton, Chip, useTheme, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserStore } from '../../store/userStore';
import { sendMessage, getChatHistory, requestPlan } from '../../services/ai';
import { ConversationMessage } from '../../services/ai/types';
import { getUserById } from '../../services/database/userDao';
import { getMealLogsByDate } from '../../services/database/mealDao';
import { getRecentSessions } from '../../services/database/workoutDao';
import { deleteAllConversations } from '../../services/database/aiDao';
import { buildContextString } from '../../services/ai/promptBuilder';
import { todayString } from '../../utils/helpers';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { usePremiumStore } from '../../store/premiumStore';
import { PaywallModal } from '../../components/PaywallModal';
import { MedicalDisclaimer } from '../../components/MedicalDisclaimer';
import { checkDailyLimit } from '../../services/premium/featureGate';
import { incrementUsage, getRemainingUsage, getDailyLimit } from '../../services/ai/rateLimiter';

type PlanType = 'workout' | 'nutrition' | 'weekly';

export function AICoachScreen() {
  const insets = useSafeAreaInsets();
  const userId = useUserStore((s) => s.userId);
  const theme = useTheme();
  const { t } = useLanguage();
  const flatListRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const isPremium = usePremiumStore((s) => s.isPremium);
  const [remainingToday, setRemainingToday] = useState<number>(getDailyLimit('ai_coach'));

  const quickPrompts = [
    t.aiCoach.prompt1,
    t.aiCoach.prompt2,
    t.aiCoach.prompt3,
    t.aiCoach.prompt4,
    t.aiCoach.prompt5,
  ];

  const planOptions: { type: PlanType; label: string; icon: string }[] = [
    { type: 'workout', label: t.aiCoach.workoutPlan || 'Workout Plan', icon: 'dumbbell' },
    { type: 'nutrition', label: t.aiCoach.nutritionPlan || 'Nutrition Plan', icon: 'food-apple' },
    { type: 'weekly', label: t.aiCoach.weeklyPlan || 'Weekly Plan', icon: 'calendar-week' },
  ];

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const [history, remaining] = await Promise.all([
          getChatHistory(userId),
          getRemainingUsage('ai_coach'),
        ]);
        setMessages(history);
        setRemainingToday(remaining);
      } catch (e) {
        if (__DEV__) console.warn('AICoachScreen load failed:', e);
      }
    })();
  }, [userId]);

  const buildUserContext = useCallback(async (): Promise<string> => {
    if (Platform.OS === 'web') return '';
    try {
      const [user, todayMeals, recentSessions] = await Promise.all([
        getUserById(userId),
        getMealLogsByDate(userId, todayString()),
        getRecentSessions(userId, 7),
      ]);
      if (!user) return '';
      const todayCalories = todayMeals.reduce((s, m) => s + m.caloriesConsumed, 0);
      const completedWorkouts = recentSessions.filter((s) => s.completedAt !== null);
      const workoutSummary = completedWorkouts.length > 0
        ? `${completedWorkouts.length} antrenman tamamlandi`
        : 'Son 7 gunde antrenman yok';
      return buildContextString({
        userName: user.name,
        age: user.age,
        gender: user.gender,
        height: user.height,
        weight: user.weight,
        goal: user.goal,
        activityLevel: user.activityLevel,
        tdee: user.tdee,
        todayCalories,
        recentWorkoutSummary: workoutSummary,
      });
    } catch (ctxErr) {
      if (__DEV__) console.warn('Context build failed:', ctxErr);
      return '';
    }
  }, [userId]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    if (!isPremium) {
      setPaywallVisible(true);
      return;
    }

    const { allowed, remaining } = await checkDailyLimit('ai_coach');
    if (!allowed) {
      Alert.alert(t.premium.limitReached, t.premium.dailyLimitMsg);
      return;
    }

    const userMsg: ConversationMessage = {
      id: Date.now().toString(), role: 'user', content: msg, source: 'gemini_cloud', timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const context = await buildUserContext();
      const response = await sendMessage(userId, msg, context);
      await incrementUsage('ai_coach');
      const newRemaining = await getRemainingUsage('ai_coach');
      setRemainingToday(newRemaining);
      const aiMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant', content: response.message,
        source: response.source, timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e: any) {
      const errMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant', content: t.aiCoach.errorMessage,
        source: 'fallback', timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanRequest = async (planType: PlanType) => {
    if (loading) return;

    if (!isPremium) {
      setPaywallVisible(true);
      return;
    }

    const { allowed } = await checkDailyLimit('ai_coach');
    if (!allowed) {
      Alert.alert(t.premium.limitReached, t.premium.dailyLimitMsg);
      return;
    }

    setLoading(true);

    const planLabels: Record<PlanType, string> = {
      workout: 'Antrenman planı oluştur',
      nutrition: 'Beslenme planı oluştur',
      weekly: 'Haftalık plan oluştur',
    };

    const userMsg: ConversationMessage = {
      id: Date.now().toString(), role: 'user', content: planLabels[planType],
      source: 'gemini_cloud', timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const context = await buildUserContext();
      const response = await requestPlan(userId, planType, context);
      await incrementUsage('ai_coach');
      const newRemaining = await getRemainingUsage('ai_coach');
      setRemainingToday(newRemaining);
      const aiMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant', content: response.message,
        source: response.source, timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e: any) {
      const errMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant', content: t.aiCoach.errorMessage,
        source: 'fallback', timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (Platform.OS === 'web') return;
    try {
      await deleteAllConversations(userId);
      setMessages([]);
    } catch (e) {
      if (__DEV__) console.warn('Clear chat failed:', e);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Rate limit indicator + clear button */}
      <View style={[styles.rateBar, { backgroundColor: theme.colors.surfaceVariant }]}>
        {messages.length > 0 && (
          <IconButton
            icon="delete-outline"
            size={18}
            onPress={handleClearChat}
            style={{ margin: 0, padding: 0 }}
            accessibilityLabel="Clear chat history"
          />
        )}
        <View style={{ flex: 1 }} />
        {isPremium ? (
          <View style={styles.proBadge}>
            <MaterialCommunityIcons name="crown" size={12} color="#FFD700" />
            <Text style={styles.proText}>PRO</Text>
            <Text style={[styles.proText, { marginLeft: 4, color: remainingToday <= 2 ? '#FF6B6B' : '#FFD700' }]}>
              {remainingToday}/{getDailyLimit('ai_coach')}
            </Text>
          </View>
        ) : (
          <View style={styles.proBadge}>
            <MaterialCommunityIcons name="lock" size={12} color={colors.textTertiary} />
            <Text style={[styles.proText, { color: colors.textTertiary }]}>PRO</Text>
          </View>
        )}
      </View>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature="ai_coach" />

      {/* Medical / AI disclaimer shown above chat */}
      <View style={{ paddingHorizontal: spacing.md }}>
        <MedicalDisclaimer
          variant="inline"
          message={
            (t as any).aiCoach?.disclaimer ||
            'AI Coach does not provide medical, legal, or financial advice. Suggestions are for general information only; consult a doctor or registered dietitian before changing your diet or exercise.'
          }
        />
      </View>

      {/* Quick prompts + plan buttons (shown when no messages) */}
      {messages.length === 0 && (
        <ScrollView style={styles.quickPrompts} contentContainerStyle={{ paddingBottom: spacing.md }}>
          <Text style={{ fontWeight: 'bold', marginBottom: spacing.sm }}>{t.aiCoach.quickQuestions}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
            {quickPrompts.map((p) => (
              <Chip key={p} onPress={() => handleSend(p)} compact textStyle={{ fontSize: 12 }}>
                {p}
              </Chip>
            ))}
          </View>

          <Text style={{ fontWeight: 'bold', marginBottom: spacing.sm }}>Kişiselleştirilmiş Plan</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {planOptions.map((plan) => (
              <Button
                key={plan.type}
                mode="outlined"
                icon={plan.icon}
                compact
                onPress={() => handlePlanRequest(plan.type)}
                style={{ borderColor: colors.primary }}
                labelStyle={{ fontSize: 12 }}
              >
                {plan.label}
              </Button>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 16 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.bubbleText, item.role === 'user' && { color: '#fff' }]}>
              {item.content}
            </Text>
            {item.role === 'assistant' && (
              <Text style={styles.sourceTag}>
                {item.source === 'gemini_cloud' ? 'Gemini' : item.source === 'gemini_nano' ? 'On-Device' : t.aiCoach.system}
              </Text>
            )}
          </View>
        )}
      />

      {/* Loading indicator */}
      {loading && (
        <View style={[styles.bubble, styles.aiBubble, { marginHorizontal: spacing.md }]}>
          <Text style={styles.bubbleText}>{t.aiCoach.typing}</Text>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t.aiCoach.placeholder}
          mode="outlined"
          style={styles.textInput}
          onSubmitEditing={() => handleSend()}
          dense
          accessibilityLabel="Message input"
          accessibilityHint="Type a message to send to AI coach"
        />
        <IconButton
          icon="send"
          iconColor={colors.primary}
          size={28}
          onPress={() => handleSend()}
          disabled={loading || !input.trim()}
          accessibilityLabel="Send message"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rateBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 2 },
  proBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, gap: 4 },
  proText: { fontSize: 11, fontWeight: 'bold', color: '#FFD700' },
  quickPrompts: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, maxHeight: 220 },
  bubble: { maxWidth: '80%', padding: spacing.sm, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.secondary },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.divider },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  sourceTag: { fontSize: 10, color: colors.textTertiary, marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  textInput: { flex: 1 },
});
