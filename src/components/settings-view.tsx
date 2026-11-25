import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps, ReactNode, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { Colors, useTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Page = 'main' | 'terms' | 'founders' | 'password';

const VERSION = '1.0.0';

const TERMS: { title: string; body: string }[] = [
  {
    title: '1. Who can use MyTok',
    body: 'You must be at least 13 years old, or older if the law where you live requires it. You are responsible for your account and for keeping your password private.',
  },
  {
    title: '2. Your account and username',
    body: 'Every username (@name) on MyTok is unique. Do not pretend to be another person, brand or the MyTok team. We may change or remove usernames that mislead people or break these rules.',
  },
  {
    title: '3. Your content',
    body: 'You own the videos, captions and comments you post. By posting, you let MyTok store, display and share them inside the app so the service can work. You promise that you have the right to post them. Do not post other people\'s videos, music or images without permission.',
  },
  {
    title: '4. What is not allowed',
    body: 'Illegal content. Any sexual content involving minors, which we report and remove immediately. Harassment, bullying, hate or threats. Content that promotes violence, self-harm or dangerous acts. Sharing other people\'s private information. Scams, spam, fake engagement and malware. Trying to break, overload or get around the app.',
  },
  {
    title: '5. Messages',
    body: 'Use direct messages respectfully. Do not use them to harass, threaten, scam or pressure people. Never share passwords or payment details in a message.',
  },
  {
    title: '6. Reporting and enforcement',
    body: 'If you see something that breaks these rules, report it. We may remove content, limit features, or suspend or close accounts that break these rules, with or without warning when the risk is serious.',
  },
  {
    title: '7. Privacy',
    body: 'We store what is needed to run MyTok: your email, username, profile details, videos, likes, comments, follows and messages. We do not sell your personal information. You can change your profile and password in the app at any time.',
  },
  {
    title: '8. Early version',
    body: 'MyTok is new and still growing. Features may change, and the service may be unavailable or lose data at times. It is provided as it is, without guarantees.',
  },
  {
    title: '9. Changes to these terms',
    body: 'We may update these terms as MyTok grows. If you keep using the app after a change, you accept the new terms.',
  },
  {
    title: '10. Contact',
    body: 'Questions or concerns? Message the founder on MyTok: @checkingcheckers.',
  },
];

function makeStyles(c: Colors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingBottom: 40 },
    sectionLabel: {
      color: c.subtext,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginTop: 24,
      marginBottom: 8,
      paddingHorizontal: 20,
    },
    group: {
      backgroundColor: c.surface,
      marginHorizontal: 16,
      borderRadius: 12,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 14,
    },
    rowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    rowLabel: { flex: 1, color: c.text, fontSize: 16 },
    rowValue: { color: c.subtext, fontSize: 14, maxWidth: 170 },
    danger: { color: '#ff453a' },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    pageTitle: { color: c.text, fontSize: 18, fontWeight: 'bold' },
    termsTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
      marginTop: 18,
    },
    termsBody: {
      color: c.subtext,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 6,
    },
    termsDate: { color: c.subtext, fontSize: 13, paddingHorizontal: 20 },
    pad: { paddingHorizontal: 20 },
    founderWrap: { alignItems: 'center', paddingTop: 40 },
    founderAvatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    founderLetter: { color: 'white', fontSize: 40, fontWeight: 'bold' },
    founderName: {
      color: c.text,
      fontSize: 22,
      fontWeight: 'bold',
      marginTop: 16,
    },
    founderRole: { color: c.subtext, fontSize: 15, marginTop: 4 },
    input: {
      height: 48,
      borderRadius: 8,
      backgroundColor: c.surface,
      color: c.text,
      paddingHorizontal: 14,
      marginBottom: 12,
      fontSize: 16,
    },
    btn: {
      height: 48,
      borderRadius: 8,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    btnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    disabled: { opacity: 0.6 },
    error: { color: '#ff6b6b', marginBottom: 10, fontSize: 14 },
    info: { color: '#30d158', marginBottom: 10, fontSize: 14 },
  });
}

type Styles = ReturnType<typeof makeStyles>;

function Row({
  icon,
  label,
  value,
  right,
  onPress,
  danger,
  first,
  s,
  color,
}: {
  icon: IconName;
  label: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  first?: boolean;
  s: Styles;
  color: string;
}) {
  return (
    <Pressable
      style={[s.row, !first && s.rowBorder]}
      onPress={onPress}
      disabled={!onPress}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={danger ? '#ff453a' : color}
      />
      <Text style={[s.rowLabel, danger && s.danger]}>{label}</Text>
      {value !== undefined && (
        <Text style={s.rowValue} numberOfLines={1}>
          {value}
        </Text>
      )}
      {right}
      {onPress && right === undefined && !danger && (
        <MaterialCommunityIcons name="chevron-right" size={22} color="#888" />
      )}
    </Pressable>
  );
}

export default function SettingsView({ email }: { email: string }) {
  const { colors, dark, setDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [page, setPage] = useState<Page>('main');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const openPage = (p: Page) => {
    setErr('');
    setMsg('');
    setPw('');
    setPw2('');
    setPage(p);
  };

  const changePassword = async () => {
    if (pw.length < 8) {
      setErr('Password must be at least 8 characters.');
      setMsg('');
      return;
    }
    if (pw !== pw2) {
      setErr('The passwords do not match.');
      setMsg('');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setErr(error.message);
        return;
      }
      setMsg('Your password was updated.');
      setPw('');
      setPw2('');
    } catch {
      setErr('Something went wrong. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmLogOut = () => {
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          supabase.auth.signOut();
        },
      },
    ]);
  };

  const backRow = (title: string) => (
    <Pressable style={s.backRow} onPress={() => openPage('main')} hitSlop={8}>
      <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
      <Text style={s.pageTitle}>{title}</Text>
    </Pressable>
  );

  if (page === 'terms') {
    return (
      <View style={s.flex}>
        {backRow('Terms of Service')}
        <ScrollView contentContainerStyle={[s.content, s.pad]}>
          <Text style={s.termsDate}>Last updated: November 24, 2026</Text>
          {TERMS.map((t) => (
            <View key={t.title}>
              <Text style={s.termsTitle}>{t.title}</Text>
              <Text style={s.termsBody}>{t.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (page === 'founders') {
    return (
      <View style={s.flex}>
        {backRow('Founders')}
        <View style={s.founderWrap}>
          <View style={s.founderAvatar}>
            <Text style={s.founderLetter}>C</Text>
          </View>
          <Text style={s.founderName}>@checkingcheckers</Text>
          <Text style={s.founderRole}>Founder of MyTok</Text>
        </View>
      </View>
    );
  }

  if (page === 'password') {
    return (
      <View style={s.flex}>
        {backRow('Change password')}
        <ScrollView
          contentContainerStyle={[s.content, s.pad]}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={s.input}
            placeholder="New password (8+ characters)"
            placeholderTextColor="#777"
            secureTextEntry
            autoCapitalize="none"
            value={pw}
            onChangeText={setPw}
          />
          <TextInput
            style={s.input}
            placeholder="Repeat new password"
            placeholderTextColor="#777"
            secureTextEntry
            autoCapitalize="none"
            value={pw2}
            onChangeText={setPw2}
          />
          {err !== '' && <Text style={s.error}>{err}</Text>}
          {msg !== '' && <Text style={s.info}>{msg}</Text>}
          <Pressable
            style={[s.btn, busy && s.disabled]}
            onPress={changePassword}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={s.btnText}>Update password</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.sectionLabel}>Appearance</Text>
      <View style={s.group}>
        <Row
          first
          s={s}
          color={colors.text}
          icon={dark ? 'weather-night' : 'white-balance-sunny'}
          label="Dark mode"
          onPress={() => setDark(!dark)}
          right={
            <View pointerEvents="none">
              <Switch value={dark} />
            </View>
          }
        />
      </View>

      <Text style={s.sectionLabel}>Account</Text>
      <View style={s.group}>
        <Row
          first
          s={s}
          color={colors.text}
          icon="email-outline"
          label="Email"
          value={email}
        />
        <Row
          s={s}
          color={colors.text}
          icon="lock-outline"
          label="Change password"
          onPress={() => openPage('password')}
        />
      </View>

      <Text style={s.sectionLabel}>About</Text>
      <View style={s.group}>
        <Row
          first
          s={s}
          color={colors.text}
          icon="file-document-outline"
          label="Terms of Service"
          onPress={() => openPage('terms')}
        />
        <Row
          s={s}
          color={colors.text}
          icon="account-star-outline"
          label="Founders"
          onPress={() => openPage('founders')}
        />
        <Row
          s={s}
          color={colors.text}
          icon="information-outline"
          label="Version"
          value={VERSION}
        />
      </View>

      <View style={[s.group, { marginTop: 24 }]}>
        <Row
          first
          danger
          s={s}
          color={colors.text}
          icon="logout"
          label="Log out"
          onPress={confirmLogOut}
        />
      </View>
    </ScrollView>
  );
}