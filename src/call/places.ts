// What's open of Tasks and settings. Where settings has a place of its own (the open Duo) the two
// take turns in it like tabs; elsewhere settings is a sheet over whatever is open, so opening it
// leaves Tasks be. `front` stays on the last one opened while it closes, so its place fades out.
export type Place = 'tasks' | 'settings';
export type Places = { tasks: boolean; settings: boolean; front: Place };

const other = (place: Place): Place => (place === 'tasks' ? 'settings' : 'tasks');

export const opened = (now: Places, place: Place, shared: boolean): Places => ({
  ...now,
  ...(shared && { [other(place)]: false }),
  [place]: true,
  front: place,
});

export const closed = (now: Places, place: Place): Places => ({ ...now, [place]: false });

// Both can be open only where settings is a sheet; unfolded into the one place, the front one shows.
export function inView(now: Places, shared: boolean) {
  const both = shared && now.tasks && now.settings;
  return {
    tasks: now.tasks && !(both && now.front === 'settings'),
    settings: now.settings && !(both && now.front === 'tasks'),
  };
}
