import type { Stop, TripData } from './types';
// REST (all require session cookie except /api/login)
//  POST /api/login {passphrase, name} -> 204 + cookie     GET /api/me -> {name, travellers[]}
//  GET  /api/trip -> TripData
//  POST/PATCH/DELETE /api/:collection[/:id]  collection = stops|legs|flights|activities|comments|reactions|checklist|transportPlans|transportBookings  body = entity
//  POST /api/legs with {createOnly:true}: if the leg id or (fromStop,toStop) pair exists, returns it (200) unchanged
//  POST /api/stops/reorder {ids:[...all stop ids in new order]} -> {stops: Stop[]} (changed stops; 400 unknown/dup id, 409 if set differs)
//  DELETE /api/stops/:id cascades activities/legs/comments/reactions server-side (a delete ChangeEvent per row)
//  GET  /api/whatsnew -> {since, events: ChangeEvent[]}   POST /api/seen
//  GET  /api/weather?lat&lng&date -> WeatherDay
export type Collection = 'stops' | 'legs' | 'flights' | 'activities' | 'comments' | 'reactions' | 'checklist' | 'transportPlans' | 'transportBookings';
export interface ChangeEvent { id: string; collection: Collection; op: 'upsert' | 'delete'; entityId: string; entity?: unknown; author: string; at: string; summary: string }
export interface WeatherDay { date: string; tmax: number; tmin: number; rainPct?: number; code: number; kind: 'forecast' | 'typical' }
// WebSocket /ws server->client
export type WsMessage =
  | { type: 'change'; event: ChangeEvent }
  | { type: 'presence'; users: { name: string; stopId?: string }[] };
// WebSocket client->server
export type WsClientMessage = { type: 'viewing'; stopId?: string };
export interface ApiClient {
  login(passphrase: string, name: string): Promise<void>;
  me(): Promise<{ name: string; travellers: string[] } | null>;
  trip(): Promise<TripData>;
  /** opts.createOnly: only create; if it already exists (legs: same id or from/to pair) return the existing row unchanged. */
  save<T extends { id?: string }>(c: Collection, entity: T, opts?: { createOnly?: boolean }): Promise<T & { id: string }>;
  /** Atomically set stop order; `ids` must be every stop id in the new order. Returns stops whose ord changed. */
  reorderStops(ids: string[]): Promise<Stop[]>;
  remove(c: Collection, id: string): Promise<void>;
  weather(lat: number, lng: number, date: string): Promise<import('./api').WeatherDay | null>;
}
