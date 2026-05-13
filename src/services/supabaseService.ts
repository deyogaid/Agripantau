import { supabase } from '../lib/supabase';

export async function fetchSupabasePrices() {
  try {
    const { data, error } = await supabase
      .from('commodity_prices')
      .select('id, type, current_price, unit, last_updated, market_name, province, market_id')
      .order('last_updated', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching from Supabase:', error);
    return null;
  }
}

export async function fetchSupabaseHistory(type: string) {
  try {
    const { data, error } = await supabase
      .from('commodity_prices_history')
      .select('type, open_price, high_price, low_price, current_price, date')
      .eq('type', type)
      .order('date', { ascending: true })
      .limit(30);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching history:', error);
    return null;
  }
}

export async function fetchSupabaseMarkets() {
  try {
    const { data, error } = await supabase
      .from('markets')
      .select('id, name, location, province, is_primary, city');

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching markets from Supabase:', error);
    return null;
  }
}

export async function fetchSupabaseCommodities() {
  try {
    const { data, error } = await supabase
      .from('commodities')
      .select('id, name, slug, category, unit, icon, is_active')
      .eq('is_active', true);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching commodities:', error);
    return null;
  }
}
