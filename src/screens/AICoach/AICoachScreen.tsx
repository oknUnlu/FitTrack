import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, IconButton, Chip, useTheme } from 'react-native-paper';
import { useUserStore } from '../../store/userStore';
import { sendMessage, getChatHistory, getTodayRequestCount, getMaxDailyRequests } from '../../services/ai';
import { ConversationMessage } from '../../services/ai/types';
import { getUserById } from '../../services/database/userDao';
import { getMealLogsByDate } from '../../services/database/mealDao';
import { getRecentSessions } from '../../services/database/workoutDao';
import { buildContextString } from '../../services/ai/promptBuilder';
import { todayString } from '../../utils/helpers';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';

export function AICoachScreen() {
  const userId = useUserStore((s) => s.userId);
  const theme = useTheme();
  const { t } = useLanguage();
  const flatListRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  const quickPrompts = [
    t.aiCoach.prompt1,
    t.aiCoach.prompt2,
    t.aiCoach.prompt3,
    t.aiCoach.prompt4,
    t.aiCoach.prompt5,
  ];

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const history = await getChatHistory(userId);
        setMessages(history);
        const count = await getTodayRequestCount();
        setRequestCount(count);
      } catch (e) {
        console.warn('AICoachScreen load failed:', e);
      }
    })();
  }, [userId]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMsg: ConversationMessage = {
      id: Date.now().toString(), role: 'user', content: msg, source: 'gemini_cloud', timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let context = '';
      if (Platform.OS !== 'web') {
        try {
          const [user, todayMeals, recentSessions] = await Promise.all([
            getUserById(userId),
            getMealLogsByDate(userId, todayString()),
            getRecentSessions(userId, 7),
          ]);
          if (user) {
            const todayCalories = todayMeals.reduce((s, m) => s + m.caloriesConsumed, 0);
            const completedWorkouts = recentSessions.filter((s) => s.completedAt !== null);
            const workoutSummary = completedWorkouts.length > 0
              ? `${completedWorkouts.length} antrenman tamamlandı`
              : 'Son 7 günde antrenman yok';
            context = buildContextString({
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
          }
        } catch (ctxErr) {
          console.warn('Context build failed:', ctxErr);
        }
      }
      const response = await sendMessage(userId, msg, context);
      const aiMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant', content: response.message,
        source: response.source, timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setRequestCount((c) => c + 1);
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Rate limit indicator */}
      <View style={styles.rateBar}>
        <Text style={styles.rateText}>{requestCount}/{getMaxDailyRequests()} {t.aiCoach.requestsUsed}</Text>
      </View>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <View style={styles.quickPrompts}>
          <Text style={{ fontWeight: 'bold', marginBottom: spacing.sm }}>{t.aiCoach.quickQuestions}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {quickPrompts.map((p) => (
              <Chip key={p} onPress={() => handleSend(p)} compact textStyle={{ fontSize: 12 }}>
                {p}
              </Chip>
            ))}
          </View>
        </View>
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
      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t.aiCoach.placeholder}
          mode="outlined"
          style={styles.textInput}
          onSubmitEditing={() => handleSend()}
          dense
        />
        <IconButton
          icon="send"
          iconColor={colors.primary}
          size={28}
          onPress={() => handleSend()}
          disabled={loading || !input.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rateBar: { paddingHorizontal: spacing.md, paddingVertical: 4, backgroundColor: '#f5f5f5' },
  rateText: { fontSize: 11, color: '#999', textAlign: 'right' },
  quickPrompts: { padding: spacing.md },
  bubble: { maxWidth: '80%', padding: spacing.sm, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.secondary },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#F0F0F0' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  sourceTag: { fontSize: 10, color: '#999', marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: '#eee' },
  textInput: { flex: 1 },
});
