import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API = 'https://prices.runescape.wiki/api/v1/osrs';

const DEFAULT_LEVELS: Record<string, number> = {
  Attack: 20,
  Strength: 27,
  Defence: 20,
  Hitpoints: 24,
  Prayer: 11,
  Magic: 1,
  Runecraft: 1,
  Crafting: 1,
  Mining: 31,
  Smithing: 30,
  Fishing: 50,
  Cooking: 28,
  Firemaking: 13,
  Woodcutting: 11,
  Ranged: 1,
};

type Ingredient = {
  name: string;
  qty: number;
};

type Method = {
  name: string;
  skill: string;
  level: number;
  xp: number;
  inputs: Ingredient[];
  output: string;
  outputQty?: number;
  extraCost?: number;
};

const METHODS: Method[] = [
  {
    name: 'Cowhide → Leather',
    skill: 'Crafting',
    level: 1,
    xp: 0,
    inputs: [{ name: 'Cowhide', qty: 1 }],
    output: 'Leather',
    extraCost: 1,
  },
  {
    name: 'Gold ring',
    skill: 'Crafting',
    level: 5,
    xp: 15,
    inputs: [{ name: 'Gold bar', qty: 1 }],
    output: 'Gold ring',
  },
  {
    name: 'Gold necklace',
    skill: 'Crafting',
    level: 6,
    xp: 20,
    inputs: [{ name: 'Gold bar', qty: 1 }],
    output: 'Gold necklace',
  },
  {
    name: 'Gold amulet (u)',
    skill: 'Crafting',
    level: 8,
    xp: 30,
    inputs: [{ name: 'Gold bar', qty: 1 }],
    output: 'Gold amulet (u)',
  },
  {
    name: 'String gold amulet',
    skill: 'Crafting',
    level: 1,
    xp: 4,
    inputs: [
      { name: 'Gold amulet (u)', qty: 1 },
      { name: 'Ball of wool', qty: 1 },
    ],
    output: 'Gold amulet',
  },

  {
    name: 'Cut sapphire',
    skill: 'Crafting',
    level: 20,
    xp: 50,
    inputs: [{ name: 'Uncut sapphire', qty: 1 }],
    output: 'Sapphire',
  },
  {
    name: 'Sapphire ring',
    skill: 'Crafting',
    level: 20,
    xp: 40,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Sapphire', qty: 1 },
    ],
    output: 'Sapphire ring',
  },
  {
    name: 'Sapphire necklace',
    skill: 'Crafting',
    level: 22,
    xp: 55,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Sapphire', qty: 1 },
    ],
    output: 'Sapphire necklace',
  },
  {
    name: 'Sapphire amulet (u)',
    skill: 'Crafting',
    level: 24,
    xp: 65,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Sapphire', qty: 1 },
    ],
    output: 'Sapphire amulet (u)',
  },

  {
    name: 'Cut emerald',
    skill: 'Crafting',
    level: 27,
    xp: 67.5,
    inputs: [{ name: 'Uncut emerald', qty: 1 }],
    output: 'Emerald',
  },
  {
    name: 'Emerald ring',
    skill: 'Crafting',
    level: 27,
    xp: 55,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Emerald', qty: 1 },
    ],
    output: 'Emerald ring',
  },
  {
    name: 'Emerald necklace',
    skill: 'Crafting',
    level: 29,
    xp: 60,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Emerald', qty: 1 },
    ],
    output: 'Emerald necklace',
  },
  {
    name: 'Emerald amulet (u)',
    skill: 'Crafting',
    level: 31,
    xp: 70,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Emerald', qty: 1 },
    ],
    output: 'Emerald amulet (u)',
  },

  {
    name: 'Cut ruby',
    skill: 'Crafting',
    level: 34,
    xp: 85,
    inputs: [{ name: 'Uncut ruby', qty: 1 }],
    output: 'Ruby',
  },
  {
    name: 'Ruby ring',
    skill: 'Crafting',
    level: 34,
    xp: 70,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Ruby', qty: 1 },
    ],
    output: 'Ruby ring',
  },
  {
    name: 'Ruby necklace',
    skill: 'Crafting',
    level: 40,
    xp: 75,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Ruby', qty: 1 },
    ],
    output: 'Ruby necklace',
  },
  {
    name: 'Ruby amulet (u)',
    skill: 'Crafting',
    level: 50,
    xp: 85,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Ruby', qty: 1 },
    ],
    output: 'Ruby amulet (u)',
  },

  {
    name: 'Cut diamond',
    skill: 'Crafting',
    level: 43,
    xp: 107.5,
    inputs: [{ name: 'Uncut diamond', qty: 1 }],
    output: 'Diamond',
  },
  {
    name: 'Diamond ring',
    skill: 'Crafting',
    level: 43,
    xp: 85,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Diamond', qty: 1 },
    ],
    output: 'Diamond ring',
  },
  {
    name: 'Diamond necklace',
    skill: 'Crafting',
    level: 56,
    xp: 90,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Diamond', qty: 1 },
    ],
    output: 'Diamond necklace',
  },
  {
    name: 'Diamond amulet (u)',
    skill: 'Crafting',
    level: 70,
    xp: 100,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Diamond', qty: 1 },
    ],
    output: 'Diamond amulet (u)',
  },

  {
    name: 'Pastry dough',
    skill: 'Cooking',
    level: 1,
    xp: 0,
    inputs: [
      { name: 'Pot of flour', qty: 1 },
      { name: 'Jug of water', qty: 1 },
    ],
    output: 'Pastry dough',
  },
  {
    name: 'Pie shell',
    skill: 'Cooking',
    level: 1,
    xp: 0,
    inputs: [
      { name: 'Pie dish', qty: 1 },
      { name: 'Pastry dough', qty: 1 },
    ],
    output: 'Pie shell',
  },
  {
    name: 'Chocolate dust',
    skill: 'Cooking',
    level: 1,
    xp: 0,
    inputs: [{ name: 'Chocolate bar', qty: 1 }],
    output: 'Chocolate dust',
  },
  {
    name: 'Anchovy pizza',
    skill: 'Cooking',
    level: 55,
    xp: 39,
    inputs: [
      { name: 'Plain pizza', qty: 1 },
      { name: 'Anchovies', qty: 1 },
    ],
    output: 'Anchovy pizza',
  },

  {
    name: 'Enchant sapphire ring',
    skill: 'Magic',
    level: 7,
    xp: 17.5,
    inputs: [
      { name: 'Sapphire ring', qty: 1 },
      { name: 'Cosmic rune', qty: 1 },
      { name: 'Water rune', qty: 1 },
    ],
    output: 'Ring of recoil',
  },
];

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? '—'
    : Math.round(n).toLocaleString('en-US');

export default function App() {
  const [mapping, setMapping] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [volumes, setVolumes] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');

  const [gp, setGp] = useState(
    Number(localStorage.getItem('osrs-current-gp') || 200000)
  );

  const [quantity, setQuantity] = useState(
    Number(localStorage.getItem('osrs-quantity') || 500)
  );

  const [levels, setLevels] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('osrs-levels');
      return saved
        ? { ...DEFAULT_LEVELS, ...JSON.parse(saved) }
        : DEFAULT_LEVELS;
    } catch {
      return DEFAULT_LEVELS;
    }
  });

  const [availableOnly, setAvailableOnly] = useState(false);
  const [showLocked, setShowLocked] = useState(true);
  const [profitFilter, setProfitFilter] = useState('All');
  const [skill, setSkill] = useState('All');
  const [sort, setSort] = useState('profit');

  const refresh = async () => {
    setLoading(true);
    setError('');

    try {
      const [m, p, v] = await Promise.all([
        fetch(`${API}/mapping`),
        fetch(`${API}/latest`),
        fetch(`${API}/24h`),
      ]);

      if (!m.ok || !p.ok || !v.ok) throw new Error();

      const md = await m.json();
      const pd = await p.json();
      const vd = await v.json();

      setMapping(md);
      setPrices(pd.data || {});
      setVolumes(vd.data || {});
      setUpdated(new Date());
    } catch {
      setError('OSRS Wiki fiyatları alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    localStorage.setItem('osrs-current-gp', String(gp));
  }, [gp]);

  useEffect(() => {
    localStorage.setItem('osrs-quantity', String(quantity));
  }, [quantity]);

  useEffect(() => {
    localStorage.setItem('osrs-levels', JSON.stringify(levels));
  }, [levels]);

  const items = useMemo(() => {
    const x: Record<string, any> = {};
    mapping.forEach((i) => {
      x[i.name.toLowerCase()] = i;
    });
    return x;
  }, [mapping]);

  const item = (name: string) => items[name.toLowerCase()];

  const buy = (name: string): number | null => {
    const i = item(name);
    return i ? prices[i.id]?.high ?? null : null;
  };

  const sell = (name: string): number | null => {
    const i = item(name);
    return i ? prices[i.id]?.low ?? null : null;
  };

  const volume = (name: string): number | null => {
    const i = item(name);
    if (!i) return null;

    const d = volumes[i.id];
    if (!d) return null;

    return (d.highPriceVolume || 0) + (d.lowPriceVolume || 0);
  };

  const rows = useMemo(() => {
    return METHODS.map((m) => {
      let cost = m.extraCost || 0;
      let valid = true;

      for (const ingredient of m.inputs) {
        const p = buy(ingredient.name);

        if (p === null) {
          valid = false;
        } else {
          cost += p * ingredient.qty;
        }
      }

      const outputPrice = sell(m.output);

      if (outputPrice === null) valid = false;

      const outputQty = m.outputQty || 1;

      const revenue = valid ? outputPrice! * outputQty : null;
      const profit = revenue === null ? null : revenue - cost;

      const roi = profit === null || cost <= 0 ? null : (profit / cost) * 100;

      const current = levels[m.skill] ?? 1;
      const unlocked = current >= m.level;
      const vol = volume(m.output);

      const slotsPerProcess = m.inputs.reduce(
        (sum, input) => sum + input.qty,
        0
      );

      const inventoryProcesses =
        slotsPerProcess > 0 ? Math.floor(28 / slotsPerProcess) : 0;

      const inventoryProfit =
        profit === null ? null : profit * inventoryProcesses;

      const wanted = Math.max(1, Math.floor(quantity || 1));

      const requiredInputs = m.inputs.map((input) => ({
        name: input.name,
        qty: input.qty * wanted,
        unitPrice: buy(input.name),
        total:
          buy(input.name) === null
            ? null
            : buy(input.name)! * input.qty * wanted,
      }));

      const totalCost = valid ? cost * wanted : null;

      const totalRevenue = revenue === null ? null : revenue * wanted;

      const totalProfit = profit === null ? null : profit * wanted;

      const totalXp = m.xp * wanted;

      return {
        ...m,
        current,
        unlocked,
        cost: valid ? cost : null,
        revenue,
        profit,
        roi,
        vol,
        inventoryProcesses,
        inventoryProfit,
        requiredInputs,
        totalCost,
        totalRevenue,
        totalProfit,
        totalXp,
      };
    });
  }, [mapping, prices, volumes, levels, quantity]);

  const visible = useMemo(() => {
    let x = [...rows];

    if (availableOnly) {
      x = x.filter((r) => r.unlocked);
    }

    if (!showLocked) {
      x = x.filter((r) => r.unlocked);
    }

    if (profitFilter === 'Profit') {
      x = x.filter((r) => (r.profit ?? -Infinity) > 0);
    }

    if (profitFilter === 'Loss') {
      x = x.filter((r) => (r.profit ?? Infinity) < 0);
    }

    if (skill !== 'All') {
      x = x.filter((r) => r.skill === skill);
    }

    x.sort((a, b) => {
      if (sort === 'roi') {
        return (b.roi ?? -Infinity) - (a.roi ?? -Infinity);
      }

      if (sort === 'level') {
        return a.level - b.level;
      }

      if (sort === 'totalProfit') {
        return (b.totalProfit ?? -Infinity) - (a.totalProfit ?? -Infinity);
      }

      return (b.profit ?? -Infinity) - (a.profit ?? -Infinity);
    });

    return x;
  }, [rows, availableOnly, showLocked, profitFilter, skill, sort]);

  const bondItem = mapping.find(
    (i) => i.name.toLowerCase() === 'old school bond'
  );

  const bond = bondItem
    ? prices[bondItem.id]?.high ?? prices[bondItem.id]?.low ?? null
    : null;

  const bondProgress = bond ? Math.min((gp / bond) * 100, 100) : 0;

  const missing = bond ? Math.max(bond - gp, 0) : null;

  const skillNames = Object.keys(levels);

  return (
    <main>
      <header>
        <div>
          <h1>OSRS F2P Money Scanner</h1>
          <p>Canlı GE processing fırsatları</p>
        </div>

        <button onClick={refresh} disabled={loading}>
          {loading ? 'Güncelleniyor...' : '↻ Fiyatları Güncelle'}
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="cards">
        <div className="card">
          <label>MEVCUT GP</label>

          <input
            type="number"
            value={gp}
            min="0"
            onChange={(e) => setGp(Math.max(0, Number(e.target.value)))}
          />
        </div>

        <div className="card">
          <label>ÜRETİM ADEDİ</label>

          <input
            type="number"
            value={quantity}
            min="1"
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          />
        </div>

        <div className="card">
          <label>BOND FİYATI</label>
          <strong>{fmt(bond)} GP</strong>
        </div>

        <div className="card">
          <label>BOND'A KALAN</label>
          <strong>{fmt(missing)} GP</strong>
        </div>

        <div className="card">
          <label>İLERLEME</label>

          <strong>{bond ? bondProgress.toFixed(2) : '—'}%</strong>

          <div className="bar">
            <div
              style={{
                width: `${bondProgress}%`,
              }}
            />
          </div>
        </div>
      </section>

      <section className="filters">
        <label>
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          Şu an yapabildiklerim
        </label>

        <label>
          <input
            type="checkbox"
            checked={showLocked}
            onChange={(e) => setShowLocked(e.target.checked)}
          />
          Kilitlileri göster
        </label>

        <select
          value={profitFilter}
          onChange={(e) => setProfitFilter(e.target.value)}
        >
          <option value="All">Kâr/Zarar: Tümü</option>

          <option value="Profit">Sadece kârlılar</option>

          <option value="Loss">Sadece zararlılar</option>
        </select>

        <select value={skill} onChange={(e) => setSkill(e.target.value)}>
          <option value="All">Tüm skill'ler</option>

          <option>Crafting</option>
          <option>Cooking</option>
          <option>Magic</option>
        </select>

        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="profit">Kâr/adet ↓</option>

          <option value="totalProfit">Toplam kâr ↓</option>

          <option value="roi">ROI ↓</option>

          <option value="level">Gerekli level ↑</option>
        </select>
      </section>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 7,
        }}
      >
        <div
          style={{
            fontWeight: 'bold',
            marginBottom: 10,
            color: '#e3b341',
          }}
        >
          Skill Seviyelerim
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {skillNames.map((s) => (
            <label
              key={s}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
              }}
            >
              {s}

              <input
                type="number"
                min="1"
                max="99"
                value={levels[s]}
                onChange={(e) => {
                  const n = Math.min(99, Math.max(1, Number(e.target.value)));

                  setLevels((old) => ({
                    ...old,
                    [s]: n,
                  }));
                }}
                style={{
                  width: 55,
                  background: '#0d1117',
                  color: 'white',
                  border: '1px solid #30363d',
                  borderRadius: 4,
                  padding: 5,
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="explain">
        <b>Hammadde:</b> HIGH (hızlı alış) &nbsp;•&nbsp;
        <b>Ürün:</b> LOW (hızlı satış) &nbsp;•&nbsp; Üretim adedi:{' '}
        <b>{fmt(quantity)}</b>
        &nbsp;•&nbsp; Son fiyat güncellemesi:{' '}
        <b>{updated ? updated.toLocaleTimeString('tr-TR') : '—'}</b>
      </div>

      <div className="tableBox">
        <table>
          <thead>
            <tr>
              <th>Yöntem</th>
              <th>Skill</th>
              <th>Level</th>
              <th>Hammadde / adet</th>
              <th>Maliyet/adet</th>
              <th>Satış/adet</th>
              <th>Kâr/adet</th>
              <th>ROI</th>
              <th>XP/adet</th>
              <th>Inv. Kâr</th>
              <th>24h Hacim</th>
              <th>Durum</th>
              <th>{fmt(quantity)} ADET İÇİN AL</th>
              <th>Toplam Maliyet</th>
              <th>Toplam Satış</th>
              <th>Toplam Kâr</th>
              <th>Toplam XP</th>
            </tr>
          </thead>

          <tbody>
            {visible.map((r) => {
              const lowVolume = r.vol !== null && r.vol < 1000;

              return (
                <tr key={r.name} className={!r.unlocked ? 'lockedRow' : ''}>
                  <td className="name">{r.name}</td>

                  <td>{r.skill}</td>

                  <td>
                    {r.current} / {r.level}
                  </td>

                  <td>
                    {r.inputs.map((i) => `${i.qty}× ${i.name}`).join(' + ')}
                  </td>

                  <td>{fmt(r.cost)}</td>

                  <td>{fmt(r.revenue)}</td>

                  <td
                    className={(r.profit ?? 0) >= 0 ? 'positive' : 'negative'}
                  >
                    {r.profit !== null && r.profit > 0 ? '+' : ''}

                    {fmt(r.profit)}
                  </td>

                  <td className={(r.roi ?? 0) >= 0 ? 'positive' : 'negative'}>
                    {r.roi === null ? '—' : `${r.roi.toFixed(1)}%`}
                  </td>

                  <td>{r.xp}</td>

                  <td
                    className={
                      (r.inventoryProfit ?? 0) >= 0 ? 'positive' : 'negative'
                    }
                  >
                    {fmt(r.inventoryProfit)}
                  </td>

                  <td>
                    {fmt(r.vol)}

                    {lowVolume && <span className="warn"> ⚠</span>}
                  </td>

                  <td>
                    {r.unlocked ? (
                      <span className="open">✓ AÇIK</span>
                    ) : (
                      <span className="locked">
                        🔒 {r.skill} {r.level}
                      </span>
                    )}
                  </td>

                  <td>
                    {r.requiredInputs.map((input, index) => (
                      <div key={index}>
                        <b>{fmt(input.qty)}</b> × {input.name}
                        {input.unitPrice !== null && (
                          <span
                            style={{
                              color: '#8b949e',
                            }}
                          >
                            {' '}
                            @ {fmt(input.unitPrice)}
                          </span>
                        )}
                      </div>
                    ))}

                    {r.extraCost ? (
                      <div
                        style={{
                          color: '#8b949e',
                        }}
                      >
                        + {fmt(r.extraCost * quantity)} GP işlem ücreti
                      </div>
                    ) : null}
                  </td>

                  <td>{fmt(r.totalCost)}</td>

                  <td>{fmt(r.totalRevenue)}</td>

                  <td
                    className={
                      (r.totalProfit ?? 0) >= 0 ? 'positive' : 'negative'
                    }
                  >
                    {r.totalProfit !== null && r.totalProfit > 0 ? '+' : ''}

                    {fmt(r.totalProfit)}
                  </td>

                  <td>{fmt(r.totalXp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="foot">
        ⚠ Düşük hacimli ürünlerde görünen marj gerçekleşmeyebilir. HIGH =
        hammaddenin hızlı alış fiyatı, LOW = ürünün hızlı satış fiyatı.
      </p>
    </main>
  );
}
