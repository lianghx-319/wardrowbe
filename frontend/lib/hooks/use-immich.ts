'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api, setAccessToken } from '@/lib/api';

function useSetTokenIfAvailable() {
  const { data: session } = useSession();
  if (session?.accessToken) {
    setAccessToken(session.accessToken as string);
  }
}

export interface ImmichConnection {
  configured: boolean;
  id?: string;
  base_url?: string;
  album_id?: string;
  album_name?: string;
  status?: 'connected' | 'error';
  last_scan_at?: string;
  last_error?: string;
}

export interface ImmichAlbum {
  id: string;
  album_name: string;
  asset_count: number;
}

export interface ImmichScanResult {
  imported: number;
  skipped_existing_asset: number;
  skipped_duplicate_hash: number;
  failed: number;
  queued: number;
  message: string;
}

export function useImmichConnection() {
  const { status } = useSession();
  useSetTokenIfAvailable();

  return useQuery({
    queryKey: ['immich-connection'],
    queryFn: () => api.get<ImmichConnection>('/immich/connection'),
    enabled: status !== 'loading',
  });
}

export function useImmichAlbums(enabled = true) {
  const { status } = useSession();
  useSetTokenIfAvailable();

  return useQuery({
    queryKey: ['immich-albums'],
    queryFn: () => api.get<ImmichAlbum[]>('/immich/albums'),
    enabled: enabled && status !== 'loading',
  });
}

export function useTestImmichConnection() {
  return useMutation({
    mutationFn: (data: { base_url: string; api_key: string }) =>
      api.post<{ status: string; albums: ImmichAlbum[] }>('/immich/connection/test', data),
  });
}

export function useSaveImmichConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      base_url: string;
      api_key?: string;
      album_id: string;
      album_name: string;
    }) => api.put<ImmichConnection>('/immich/connection', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['immich-connection'] });
      queryClient.invalidateQueries({ queryKey: ['immich-albums'] });
    },
  });
}

export function useScanImmich() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<ImmichScanResult>('/immich/scan'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['immich-connection'] });
    },
  });
}
