/**
 * ユーザーの表示名から「苗字（姓）」を抽出・整形するユーティリティ
 */

export function extractSurname(displayName: string | null | undefined): string {
  if (!displayName || !displayName.trim()) {
    return '職員';
  }

  const trimmed = displayName.trim();

  // 半角・全角スペースで分割
  const parts = trimmed.split(/[\s　]+/);
  if (parts.length > 1) {
    // 最初の部分を苗字とする（例: 「紙谷 雅樹」→「紙谷」）
    return parts[0];
  }

  // スペースがない場合：
  // 4文字以上で漢字のみの場合、日本の典型的な2文字姓を推定（例: 「紙谷雅樹」→「紙谷」）
  if (trimmed.length >= 4 && /^[\u4E00-\u9FFF]+$/.test(trimmed)) {
    return trimmed.slice(0, 2);
  }

  // 3文字で漢字の場合（例: 「中野一」→「中野」）
  if (trimmed.length === 3 && /^[\u4E00-\u9FFF]+$/.test(trimmed)) {
    return trimmed.slice(0, 2);
  }

  return trimmed;
}

/**
 * 有効な表示姓を決定（カスタム設定された姓があればそれを最優先）
 */
export function getEffectiveSurname(customSurname?: string, displayName?: string | null): string {
  if (customSurname && customSurname.trim()) {
    return customSurname.trim();
  }
  return extractSurname(displayName);
}
