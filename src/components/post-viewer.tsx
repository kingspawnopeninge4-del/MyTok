import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    FlatList,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type PostRow = {
  id: string;
  title: string;
  description: string;
  hashtags: string[];
  image_urls: string[];
  created_at: string;
};

export default function PostViewer({
  post,
  username,
  onClose,
}: {
  post: PostRow;
  username: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const imgHeight = Math.round(height * 0.6);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="white" />
        </Pressable>
        <Text style={styles.headerName}>@{username}</Text>
        <Text style={styles.counter}>
          {page + 1}/{post.image_urls.length}
        </Text>
      </View>

      <FlatList
        style={{ flexGrow: 0 }}
        data={post.image_urls}
        keyExtractor={(u, i) => u + i}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width, height: imgHeight }}
            resizeMode="contain"
          />
        )}
      />

      {post.image_urls.length > 1 && (
        <View style={styles.dots}>
          {post.image_urls.map((u, i) => (
            <View
              key={u + i}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>
      )}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.info,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        <Text style={styles.title}>{post.title}</Text>
        {post.description !== '' && (
          <Text style={styles.desc}>{post.description}</Text>
        )}
        {post.hashtags.length > 0 && (
          <Text style={styles.tags}>
            {post.hashtags.map((t) => '#' + t).join(' ')}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: 'black' },
  header: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { position: 'absolute', left: 16 },
  headerName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  counter: {
    position: 'absolute',
    right: 16,
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#555',
  },
  dotActive: { backgroundColor: 'white' },
  info: { paddingHorizontal: 16, paddingTop: 14 },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  desc: { color: 'white', fontSize: 15, lineHeight: 21, marginTop: 8 },
  tags: { color: '#3ea6ff', fontSize: 15, fontWeight: '600', marginTop: 8 },
});