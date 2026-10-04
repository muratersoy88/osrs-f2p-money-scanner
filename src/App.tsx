                  <td>
                    {r.skill}
                    <br />
                    {r.currentLevel}/{r.level}
                  </td>

                  <td>
                    {fmt(r.effectiveCost)}
                  </td>

                  <td>
                    {fmt(r.outputNet)}
                  </td>

                  <td
                    className={
                      (r.profit ?? 0) >= 0
                        ? 'positive'
                        : 'negative'
                    }
                  >
                    {r.profit !== null &&
                    r.profit > 0
                      ? '+'
                      : ''}
                    {fmt(r.profit)}
                  </td>

                  <td
  className={
    (r.profitForQty ?? 0) >= 0
      ? 'positive'
      : 'negative'
  }
>
  {r.profitForQty !== null &&
  r.profitForQty > 0
    ? '+'
    : ''}
  {fmt(r.profitForQty)}
</td>

                  <td
                    className={
                      (r.roi ?? 0) >= 0
                        ? 'positive'
                        : 'negative'
                    }
                  >
                    {r.roi === null
                      ? '—'
                      : `${r.roi.toFixed(1)}%`}
                  </td>

                  <td>{fmt(r.xp, 1)}</td>

                  <td
                    className={
                      (r.profitPerXp ?? 0) >= 0
                        ? 'positive'
                        : 'negative'
                    }
                  >
                    {fmt(r.profitPerXp, 2)}
                  </td>

                  <td>
                    {(r.successRate * 100).toFixed(0)}%
                  </td>

                  <td>
                    {fmt(r.dailyVolume)}
                    {lowVolume && (
                      <div className="warn">
                        ⚠ LOW VOLUME
                      </div>
                    )}
                  </td>

                  <td>
                    <b>{fmt(r.effectiveItemsPerHour)}/h</b>
                    <div style={{ fontSize: 8, color: '#8b949e' }}>
                      Teorik {fmt(r.theoreticalItemsPerHour)}/h
                      {r.speedSource === 'GERÇEK' ? ` • Gerçek ${fmt(r.effectiveItemsPerHour)}/h` : ''}
                    </div>
                  </td>

                  <td
                    className={
                      (r.gpHour ?? 0) >= 0
                        ? 'positive'
                        : 'negative'
                    }
                  >
                    {fmt(r.gpHour)}
                  </td>

                  <td>{fmt(r.xpHour)}</td>

                  <td>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 'bold',
                        color: r.speedSource === 'GERÇEK' ? '#3fb950' : '#d29922',
                      }}
                    >
                      {r.speedSource === 'GERÇEK' ? 'GERÇEK ÖLÇÜM' : 'TAHMİN'}
                    </span>
                  </td>

                  <td>
                    <span style={{ fontSize: 9, fontWeight: 'bold' }}>{r.purpose}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="foot">
        F2P modunda MEMBERS yöntemleri ekonomik sıralamaya katılmaz. Gerçek hız girilmişse GP/h ve XP/h gerçek ölçümü, yoksa teorik tahmini kullanır. Gerçek fiyat override'ları yalnızca ilgili yöntemin hesabını değiştirir; canlı Wiki verisini değiştirmez. Düşük hacimli ürünlerde görünen marjı
        büyük miktarda işlem yapmadan önce 1–10 adet ile doğrula.
      </p>
    </main>
  )
}
