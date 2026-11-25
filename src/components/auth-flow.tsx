import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth';
import { uploadAvatar } from '@/lib/avatar';
import { supabase } from '@/lib/supabase';

type Step = 'welcome' | 'signup' | 'login' | 'verify';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function AuthFlow() {
  const { bumpProfile } = useAuth();

  const [step, setStep] = useState<Step>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarB64, setAvatarB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const goTo = (next: Step) => {
    setError('');
    setInfo('');
    setStep(next);
  };

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setAvatarUri(asset.uri);
        setAvatarB64(asset.base64 ?? null);
      }
    } catch {
      setError('Could not open your photos.');
    }
  };

  const saveAvatar = async (userId: string) => {
    if (!avatarB64) {
      return;
    }
    const url = await uploadAvatar(userId, avatarB64);
    if (url) {
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      bumpProfile();
    }
  };

  const handleSignUp = async () => {
    const e = email.trim().toLowerCase();
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) {
      setError('Username must be 3-20 characters: letters, numbers or _ only.');
      return;
    }
    if (!EMAIL_RE.test(e)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data: taken } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', u)
        .maybeSingle();
      if (taken) {
        setError('That username is already taken.');
        return;
      }

      const { data, error: err } = await supabase.auth.signUp({
        email: e,
        password,
        options: { data: { username: u } },
      });
            if (err) {
        setError(
          err.message.toLowerCase().includes('database error')
            ? 'That username is already taken.'
            : err.message
        );
        return;
      }
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError('An account with this email already exists. Try logging in.');
        return;
      }
      if (data.session && data.user) {
        // Email confirmation is off in Supabase, so we are already signed in
        await saveAvatar(data.user.id);
        return;
      }
      setEmail(e);
      setStep('verify');
      setInfo(`We sent a confirmation code to ${e}.`);
    } catch {
      setError('Something went wrong. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    const token = code.trim();
    if (token.length < 6) {
      setError('Enter the code from your email.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'signup',
      });
      if (err) {
        setError(err.message);
        return;
      }
      const user = data.user ?? data.session?.user ?? null;
      if (user) {
        await saveAvatar(user.id);
      }
    } catch {
      setError('Something went wrong. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });
      if (err) {
        setError(err.message);
        return;
      }
      setInfo('A new code was sent.');
    } catch {
      setError('Could not resend the code.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e) || password.length === 0) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      });
      if (err) {
        if (err.message.toLowerCase().includes('not confirmed')) {
          await supabase.auth.resend({ type: 'signup', email: e });
          setEmail(e);
          setStep('verify');
          setInfo('Your email is not confirmed yet. We sent you a new code.');
          return;
        }
        setError(err.message);
      }
    } catch {
      setError('Something went wrong. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  const backButton = (target: Step) => (
    <Pressable style={styles.back} onPress={() => goTo(target)} hitSlop={10}>
      <MaterialCommunityIcons name="arrow-left" size={26} color="white" />
    </Pressable>
  );

  const messages = (
    <View>
      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {info !== '' && <Text style={styles.info}>{info}</Text>}
    </View>
  );

  if (step === 'welcome') {
    return (
      <ScrollView contentContainerStyle={styles.centerContent}>
        <MaterialCommunityIcons name="account-circle-outline" size={90} color="#888" />
        <Text style={styles.bigTitle}>New to MyTok?</Text>
        <Pressable style={styles.primaryBtn} onPress={() => goTo('signup')}>
          <Text style={styles.primaryText}>Create an account</Text>
        </Pressable>

        <Text style={[styles.bigTitle, styles.secondTitle]}>
          Already have an account?
        </Text>
        <Pressable style={styles.outlineBtn} onPress={() => goTo('login')}>
          <Text style={styles.outlineText}>Log in to MyTok</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (step === 'signup') {
    return (
      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        {backButton('welcome')}
        <Text style={styles.heading}>Create your account</Text>

        <Pressable style={styles.photoWrap} onPress={pickPhoto}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoEmpty]}>
              <MaterialCommunityIcons name="camera-plus-outline" size={34} color="#aaa" />
            </View>
          )}
          <Text style={styles.photoLabel}>
            {avatarUri ? 'Change profile picture' : 'Add profile picture (optional)'}
          </Text>
        </Pressable>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#777"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#777"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (8+ characters)"
          placeholderTextColor="#777"
          autoCapitalize="none"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {messages}

        <Pressable
          style={[styles.primaryBtn, busy && styles.disabled]}
          onPress={handleSignUp}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.primaryText}>Sign up</Text>
          )}
        </Pressable>

        <Pressable onPress={() => goTo('login')}>
          <Text style={styles.link}>Already have an account? Log in</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (step === 'verify') {
    return (
      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        {backButton('signup')}
        <Text style={styles.heading}>Confirm your email</Text>
        <Text style={styles.sub}>
          Enter the code we sent to {email}. Check your spam folder if you
          don't see it.
        </Text>

        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="Code"
          placeholderTextColor="#777"
          keyboardType="number-pad"
          maxLength={10}
          value={code}
          onChangeText={setCode}
        />

        {messages}

        <Pressable
          style={[styles.primaryBtn, busy && styles.disabled]}
          onPress={handleVerify}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.primaryText}>Confirm account</Text>
          )}
        </Pressable>

        <Pressable onPress={handleResend} disabled={busy}>
          <Text style={styles.link}>Send a new code</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.formContent}
      keyboardShouldPersistTaps="handled"
    >
      {backButton('welcome')}
      <Text style={styles.heading}>Log in to MyTok</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#777"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#777"
        autoCapitalize="none"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {messages}

      <Pressable
        style={[styles.primaryBtn, busy && styles.disabled]}
        onPress={handleLogin}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.primaryText}>Log in</Text>
        )}
      </Pressable>

      <Pressable onPress={() => goTo('signup')}>
        <Text style={styles.link}>New to MyTok? Create an account</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  formContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
  },
  heading: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sub: {
    color: '#aaa',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  bigTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 14,
    textAlign: 'center',
  },
  secondTitle: {
    marginTop: 40,
  },
  primaryBtn: {
    backgroundColor: '#ff2d55',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 8,
  },
  primaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  outlineBtn: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  outlineText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  input: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
    color: 'white',
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 6,
    height: 56,
  },
  error: {
    color: '#ff6b6b',
    marginBottom: 10,
    fontSize: 14,
  },
  info: {
    color: '#69db7c',
    marginBottom: 10,
    fontSize: 14,
  },
  link: {
    color: '#3ea6ff',
    textAlign: 'center',
    marginTop: 18,
    fontSize: 15,
  },
  photoWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  photoEmpty: {
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    color: '#3ea6ff',
    marginTop: 8,
    fontSize: 14,
  },
});