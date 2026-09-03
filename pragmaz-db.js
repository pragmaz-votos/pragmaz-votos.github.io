// ============================================================================
// Pragmaz Votos — capa de datos sobre Supabase.
//
// Expone la misma forma: .collection(x).onSnapshot(cb),
// .doc(x).onSnapshot(cb), .doc(x).set(data) — para que el resto del código de
// cada página (nicaragua-sugar-estates.html, compania-licorera.html,
// banco-avanz.html) casi no tuviera que cambiar.
//
// Requiere que la página también cargue, en este orden:
//   1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
//   2. config.js
//   3. este archivo (pragmaz-db.js)
//
// Todas las lecturas/escrituras/tiempo real pasan por una sola tabla genérica
// "artifact_kv" (board, collection, id, payload jsonb) protegida con RLS que
// exige sesión autenticada — ver README.md para el SQL de creación.
// ============================================================================
(function () {
  const TABLE = 'artifact_kv';

  function makeDb(client, board) {
    function parsePath(path) {
      const idx = path.indexOf('/');
      if (idx === -1) return { collection: path, id: null };
      return { collection: path.slice(0, idx), id: path.slice(idx + 1) };
    }

    function doc(path) {
      const { collection, id } = parsePath(path);
      return {
        onSnapshot(cb, errCb) {
          let stopped = false;

          async function fetchOnce() {
            const { data, error } = await client
              .from(TABLE)
              .select('*')
              .eq('board', board)
              .eq('collection', collection)
              .eq('id', id)
              .maybeSingle();
            if (stopped) return;
            if (error) { errCb && errCb(error); return; }
            cb({ exists: !!data, data: () => (data ? data.payload : undefined) });
          }

          fetchOnce();

          const channel = client
            .channel('kv-doc-' + board + '-' + collection + '-' + id)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: TABLE, filter: `board=eq.${board}` },
              (payload) => {
                const row = payload.new || payload.old;
                if (!row || row.collection !== collection || row.id !== id) return;
                if (payload.eventType === 'DELETE') { cb({ exists: false, data: () => undefined }); return; }
                cb({ exists: true, data: () => payload.new.payload });
              }
            )
            .subscribe();

          return () => { stopped = true; client.removeChannel(channel); };
        },
        set(data) {
          // .upsert() devuelve un objeto "thenable" (tiene .then) pero no una
          // Promise real, así que no trae .catch()/.finally(). Envolverlo en
          // Promise.resolve() lo convierte en una Promise normal.
          return Promise.resolve(
            client
              .from(TABLE)
              .upsert(
                { board, collection, id, payload: data, updated_at: new Date().toISOString() },
                { onConflict: 'board,collection,id' }
              )
          ).then((res) => {
            if (res && res.error) throw res.error;
            return res;
          });
        },
      };
    }

    function collection(name) {
      return {
        onSnapshot(cb, errCb) {
          let stopped = false;

          async function fetchAll() {
            const { data, error } = await client
              .from(TABLE)
              .select('*')
              .eq('board', board)
              .eq('collection', name);
            if (stopped) return;
            if (error) { errCb && errCb(error); return; }
            cb({ docs: data.map((row) => ({ id: row.id, data: () => row.payload })) });
          }

          fetchAll();

          const channel = client
            .channel('kv-col-' + board + '-' + name)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: TABLE, filter: `board=eq.${board}` },
              (payload) => {
                const row = payload.new || payload.old;
                if (!row || row.collection !== name) return;
                fetchAll();
              }
            )
            .subscribe();

          return () => { stopped = true; client.removeChannel(channel); };
        },
      };
    }

    return { doc, collection };
  }

  window.PragmazDB = {
    // board: identificador de tablero ('nicaragua-sugar-estates', 'compania-licorera', 'banco-avanz')
    async init(board) {
      const cfg = window.PRAGMAZ_CONFIG;
      if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-PROJECT-REF')) {
        throw new Error('config.js no está configurado todavía (faltan las credenciales de Supabase).');
      }
      const client = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      const { error } = await client.auth.signInWithPassword({
        email: cfg.VOTER_EMAIL,
        password: cfg.VOTER_PASSWORD,
      });
      if (error) throw error;
      return makeDb(client, board);
    },

    // Reemplaza la capacidad "downloads" de Claude con una descarga normal de archivo en el navegador.
    downloads: {
      save({ filename, data }) {
        try {
          const blob = new Blob([data], { type: 'text/html' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          return Promise.resolve();
        } catch (e) {
          return Promise.reject(e);
        }
      },
    },
  };
})();
