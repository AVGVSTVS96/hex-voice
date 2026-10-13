// Runs in the browser page that scripts/activity-orbs.mts drives.
window.loadOrb = ({ color, palette }) =>
  new Promise((resolve, reject) => {
    const { Rive, RuntimeLoader, Layout, Fit } = window.rive;
    RuntimeLoader.setWasmUrl('/rive.wasm');
    const rive = new Rive({
      src: '/orb.riv',
      canvas: document.getElementById('orb'),
      stateMachines: 'default',
      autoplay: true,
      autoBind: false,
      layout: new Layout({ fit: Fit.Contain }),
      onLoadError: reject,
      onLoad: () => {
        rive.resizeDrawingSurfaceToCanvas();
        const model = rive.defaultViewModel()?.defaultInstance();
        if (model) {
          rive.bindViewModelInstance(model);
          // The first advance writes the file's own color back, as in the native renderer.
          const tint = model.color('color');
          const rgb = color && [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
          if (tint && rgb) setInterval(() => tint.argb(255, ...rgb), 16);
        }
        for (const input of rive.stateMachineInputs('default')) {
          if (['listening', 'thinking', 'speaking', 'asleep'].includes(input.name))
            input.value = false;
          if (input.name === 'color' && palette) input.value = palette;
        }
        resolve();
      },
    });
  });

window.cropOrb = async ({ shot, size }) => {
  const image = new Image();
  image.src = `data:image/png;base64,${shot}`;
  await image.decode();
  const read = new OffscreenCanvas(image.width, image.height).getContext('2d');
  read.drawImage(image, 0, 0);
  const { data, width, height } = read.getImageData(0, 0, image.width, image.height);
  let [left, top, right, bottom] = [width, height, 0, 0];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  const side = Math.max(right - left, bottom - top) + 2;
  const out = new OffscreenCanvas(size, size);
  out
    .getContext('2d')
    .drawImage(
      image,
      (left + right - side) / 2,
      (top + bottom - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
  const bytes = new Uint8Array(
    await (await out.convertToBlob({ type: 'image/png' })).arrayBuffer(),
  );
  return btoa(String.fromCharCode(...bytes));
};
