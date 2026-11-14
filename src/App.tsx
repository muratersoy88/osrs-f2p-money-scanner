            <label style={{display:'flex',gap:4,alignItems:'center'}}><input type="checkbox" checked={bulkMissingOnly} onChange={e=>setBulkMissingOnly(e.target.checked)}/> Rate missing only</label>
            <button onClick={()=>copyText(bulkTsv())}>Copy TSV</button>
            <button onClick={()=>exportCsv(bulkTsv(),'osrs-filtered-activities.csv')}>Export CSV</button>
            <label style={{display:'inline-block'}}><span style={{display:'inline-block',padding:'6px 10px',border:'1px solid #30363d',borderRadius:6,cursor:'pointer'}}>Import CSV File</span><input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" style={{display:'none'}} onChange={e=>{importCsvFile(e.target.files?.[0]||null);e.currentTarget.value=''}}/></label>
            <button onClick={()=>copyText(missingRateTsv())}>Export Missing Rate List</button>
          </div>
          <div style={{fontSize:10,color:'#8b949e',marginTop:6}}>{bulkActivityRows.length} activity gösteriliyor.</div>
        </section>

        <section style={{marginBottom:12}}>
          <div className="tableBox"><table><thead><tr><th>Select</th><th>Activity ID</th><th>Activity</th><th>F2P/P2P</th><th>Skill</th><th>Level</th><th>Quality</th><th>Theory Rate/h</th><th>Estimated Rate/h</th><th>Measured Rate/h</th><th>XP/unit</th><th>Attention</th><th>Notes</th></tr></thead><tbody>
            {bulkActivityRows.map(x=><tr key={x.id}><td><input type="checkbox" checked={!!bulkSelected[x.id]} onChange={e=>setBulkSelected(s=>({...s,[x.id]:e.target.checked}))}/></td><td>{x.id}</td><td className="name">{x.name}</td><td>{x.member?'P2P':'F2P'}</td><td>{x.skills.join('/')}</td><td>{x.level}</td><td>{x.quality}</td>
              <td><input style={{width:80}} type="number" value={x.edit.theoryRate??''} onChange={e=>v5Update(x.id,{theoryRate:e.target.value===''?undefined:Number(e.target.value),rateSource:e.target.value===''?x.edit.rateSource:(x.quality==='VERIFIED'?'VERIFIED THEORY':'THEORY')})}/></td>
              <td><input style={{width:80}} type="number" value={x.edit.estimatedRate??''} onChange={e=>v5Update(x.id,{estimatedRate:e.target.value===''?undefined:Number(e.target.value),rateSource:e.target.value===''?x.edit.rateSource:'ESTIMATE'})}/></td>
              <td><b>{x.measuredRate??''}</b></td><td><input style={{width:70}} type="number" value={x.xpEach??''} onChange={e=>v5Update(x.id,{xpEach:e.target.value===''?undefined:Number(e.target.value)})}/></td>
              <td>{x.attention}</td><td>{x.edit.note??x.note??''}</td></tr>)}
          </tbody></table></div>
        </section>

        <section style={{padding:12,border:'1px solid #30363d',borderRadius:8,marginBottom:12}}>
          <h3 style={{marginTop:0}}>Bulk Edit — Selected Rows</h3>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'end'}}>
            <label>Attention<br/><select value={bulkCommonAttention} onChange={e=>setBulkCommonAttention(e.target.value)}><option value="">No change</option>{['HIGH','MEDIUM','LOW','AFK'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Quality<br/><select value={bulkCommonQuality} onChange={e=>setBulkCommonQuality(e.target.value)}><option value="">No change</option>{['VERIFIED','NEEDS_VERIFICATION','PLACEHOLDER','DUPLICATE','INCOMPLETE','DEPRECATED'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Theory/Estimate source<br/><select value={bulkCommonSource} onChange={e=>setBulkCommonSource(e.target.value)}><option value="">No change</option><option>VERIFIED THEORY</option><option>THEORY</option><option>ESTIMATE</option></select></label>
            <label>Notes<br/><input value={bulkCommonNote} onChange={e=>setBulkCommonNote(e.target.value)} placeholder="Ortak not"/></label>
            <button onClick={applyBulkCommon}>Apply to selected</button>
          </div>
        </section>

        <section style={{padding:12,border:'1px solid #30363d',borderRadius:8}}>
          <h3 style={{marginTop:0}}>TSV Import</h3>
          <div style={{fontSize:10,color:'#8b949e',marginBottom:6}}>Format: Activity ID [TAB] Theory Rate/h [TAB] Estimated Rate/h [TAB] XP/unit [TAB] Attention [TAB] Note. Exact Activity Name fallback desteklenir; duplicate isimlerde AMBIGUOUS olur.</div>
          <textarea value={bulkPaste} onChange={e=>{setBulkPaste(e.target.value);setBulkPreview([])}} rows={8} style={{width:'100%',boxSizing:'border-box'}} placeholder={'Activity ID\tTheory Rate/h\tEstimated Rate/h\tXP/unit\tAttention\tNote'}/>
          <div style={{display:'flex',gap:8,alignItems:'center',marginTop:7,flexWrap:'wrap'}}>
            <button onClick={parseBulkPreview}>Preview Import</button>
            <button onClick={applyBulkImport} disabled={!!bulkValidationErrors.length||bulkPreview.some(x=>x.status==='NOT FOUND'||x.status==='AMBIGUOUS')||!bulkPreview.some(x=>x.status==='WOULD UPDATE')}>Confirm Import</button>
            <button onClick={undoLastBulk} disabled={!bulkUndo}>Undo Last Bulk Import</button>
            <label style={{display:'flex',gap:4,alignItems:'center'}}><input type="checkbox" checked={bulkAllowMeasuredOverwrite} onChange={e=>setBulkAllowMeasuredOverwrite(e.target.checked)}/> Allow overwrite measured data</label>
          </div>
          {!!bulkValidationErrors.length&&<div className="error" style={{marginTop:8}}><b>IMPORT DURDURULDU — {bulkValidationErrors.length} validation error</b><div style={{maxHeight:140,overflow:'auto',fontSize:10}}>{bulkValidationErrors.slice(0,50).map((e,i)=><div key={i}>{e}</div>)}</div></div>}
          {bulkReport&&<div style={{marginTop:10,padding:10,border:'1px solid #30363d',borderRadius:6,fontSize:11}}>
            <b>Bulk Import Control Report</b>
            <div>Restored records: {bulkReport.restored}</div><div>Imported/updated records: {bulkReport.updated}</div><div>Estimated rates imported: {bulkReport.estimates}</div><div>Measured rates preserved: {bulkReport.measuredPreserved}</div><div>Ignored extra columns: {bulkReport.ignored.join(', ')}</div><div>Validation errors: {bulkReport.errors}</div>
            {!!bulkReport.preview.length&&<><div style={{marginTop:6}}><b>First 10 preview</b></div>{bulkReport.preview.map((x,i)=><div key={i} style={{fontFamily:'monospace'}}>{x}</div>)}</>}
          </div>}
          {!!bulkPreview.length&&<div className="tableBox" style={{marginTop:8}}><table><thead><tr><th>Key</th><th>Activity</th><th>Status</th><th>Change</th></tr></thead><tbody>{bulkPreview.map((x,i)=><tr key={i}><td>{x.key}</td><td>{x.activityName||'—'}</td><td><b>{x.status}</b></td><td>{x.message||Object.entries(x.patch||{}).map(([k,v])=>`${k}=${v}`).join(' • ')}</td></tr>)}</tbody></table></div>}
        </section>
      </div>}

      {activeTab==='coverage'&&<div>
        <section style={{padding:12,border:'1px solid #58a6ff',borderRadius:8,marginBottom:12}}>
          <h3 style={{marginTop:0,color:'#f0f6fc'}}>Canonical Economy Coverage</h3>
          <div style={{fontSize:11,color:'#8b949e',marginBottom:10}}>Canonical Economy Coverage yalnız manifestteki economy family hedeflerini ölçer. Full Activity Database Quality ise tüm katalogdaki VERIFIED / NEEDS_VERIFICATION / PLACEHOLDER dağılımıdır; iki oran birbirine karıştırılmaz.</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <div className="card"><b>F2P manifest coverage</b><div style={{fontSize:24}}>{coverageSummary.f2p.pct.toFixed(1)}%</div><small>{coverageSummary.f2p.VERIFIED}/{coverageSummary.f2p.total} VERIFIED • {coverageSummary.f2p.MISSING} MISSING</small></div>
            <div className="card"><b>MEMBERS manifest coverage</b><div style={{fontSize:24}}>{coverageSummary.member.pct.toFixed(1)}%</div><small>{coverageSummary.member.VERIFIED}/{coverageSummary.member.total} VERIFIED • {coverageSummary.member.MISSING} MISSING</small></div>
            <div className="card"><b>Full Activity Database Quality</b><div style={{fontSize:18}}>{qualityCounts.PLACEHOLDER} PLACEHOLDER</div><small>{qualityCounts.VERIFIED} VERIFIED • {qualityCounts.NEEDS_VERIFICATION} NEEDS VERIFICATION</small></div>
          </div>
        </section>
        <section>
          <h3 style={{color:'#f0f6fc'}}>Canonical Manifest — Missing / Quality</h3>
          <div className="tableBox"><table><thead><tr><th>Mode</th><th>Skill</th><th>Activity</th><th>Status</th><th>DB ID</th></tr></thead><tbody>
            {coverageRows.map(x=><tr key={x.canonical.key}><td>{x.canonical.member?'MEMBERS':'F2P'}</td><td>{x.canonical.page}</td><td className="name">{x.canonical.label}</td><td><b>{x.activity?.quality||'MISSING'}</b></td><td>{x.activity?.id||x.canonical.key}</td></tr>)}
          </tbody></table></div>
        </section>
      </div>}

      {activeTab==='database'&&<div>
<section style={{marginTop:18,padding:12,border:'1px solid #30363d',borderRadius:8}} id="activity-database">
        <h3 style={{marginTop:0}}>V4 — Global Activity Database Search</h3>
        <div style={{fontSize:10,color:'#8b949e',marginBottom:8}}>OPEN ve LOCKED aktiviteleri aynı katalogda ara. Doğrulanmamış kayıtlar önerilere girmez.</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input value={v4Search} onChange={e=>{setV4Search(e.target.value);setV4Page(1)}} placeholder="onyx, rune, shark, dragon, slayer..." style={{minWidth:280}} />
          <select value={v4KindFilter} onChange={e=>{setV4KindFilter(e.target.value);setV4Page(1)}}><option value="ALL">Tüm türler</option><option value="PROCESSING">Processing</option><option value="GATHERING">Gathering</option><option value="COMBAT">Combat</option><option value="MAGIC">Magic</option><option value="UTILITY">Utility</option></select>
          <label style={{fontSize:10}}><input type="checkbox" checked={v4ShowLocked} onChange={e=>{setV4ShowLocked(e.target.checked);setV4Page(1)}} /> LOCKED göster</label>
          <button type="button" onClick={()=>{setV4ViewAll(x=>!x);setV4Page(1)}}>{v4ViewAll?'View All kapat':'View All'}</button>
          <span style={{fontSize:10,color:'#8b949e'}}>Database: {v4Stats.total} • Verified: {v4Stats.verified} • Members: {v4Stats.members} • OPEN: {v4Stats.open} • LOCKED: {v4Stats.locked}</span>
        </div>
        {(v4Search || v4ViewAll) && <div className="tableBox" style={{marginTop:8}}><table><thead><tr><th>Activity</th><th>F2P/P2P</th><th>Tür</th><th>Skill / Level</th><th>Durum</th><th>Eksik / Hazırlık</th><th>Risk</th><th>Dikkat</th><th>Doğrulama</th></tr></thead><tbody>
          {v4PagedResults.map(({activity,access})=><tr key={activity.id} className={!access.open?'lockedRow':''}>
            <td className="name">{activity.name}<div style={{fontSize:9,color:'#8b949e'}}>{activity.items?.join(' • ')}</div></td>
            <td>{activity.f2p?'F2P':'MEMBER'}</td>
            <td>{activity.kind}<br/><span style={{fontSize:9}}>{activity.category}</span></td>
            <td>{activity.requirements.skills?.map(x=>`${x.skill} ${x.level}`).join(' • ')||activity.skills.join(', ')||'—'}</td>
            <td><b>{access.status}</b></td>
            <td>{access.missing.length?access.missing.join(' | '):'—'}</td>
            <td>{activity.riskType}{activity.combat?.wildernessPvpRisk&&<><br/><span style={{fontSize:9,color:'#f85149'}}>PvP risk</span></>}</td>
            <td>{activity.attention}{activity.afkWindowSeconds?<><br/><span style={{fontSize:9}}>{activity.afkWindowSeconds}s AFK</span></>:null}</td>
            <td>{activity.verified==='VERIFIED'?'✓ VERIFIED':'⚠ NEEDS VERIFICATION'}{activity.combat?.recommendedStats?.length?<div style={{fontSize:9,color:'#8b949e'}}>Öneri: {activity.combat.recommendedStats.map(x=>`${x.skill} ${x.level}`).join(' • ')}</div>:null}</td>
          </tr>)}
          {!v4SearchResults.length&&<tr><td colSpan={9}>Eşleşme yok.</td></tr>}
        </tbody></table>
          {v4SearchResults.length>0&&<div style={{display:'flex',justifyContent:'center',gap:8,alignItems:'center',padding:8}}>
            <button type="button" disabled={v4Page<=1} onClick={()=>setV4Page(p=>Math.max(1,p-1))}>← Önceki</button>
            <span>Sayfa {v4Page}/{v4PageCount} • {v4SearchResults.length} kayıt</span>
            <button type="button" disabled={v4Page>=v4PageCount} onClick={()=>setV4Page(p=>Math.min(v4PageCount,p+1))}>Sonraki →</button>
          </div>}
        </div>}
      </section>

      </div>}

      <p className="foot">
        F2P modunda MEMBERS veya F2P doğrulaması olmayan yöntemler ekonomik sıralamaya katılmaz. Gerçek hız girilmişse GP/h ve XP/h gerçek ölçümü, yoksa teorik tahmini kullanır. Gerçek fiyat override'ları yalnızca ilgili yöntemin hesabını değiştirir; canlı Wiki verisini değiştirmez. Düşük hacimli ürünlerde görünen marjı
        büyük miktarda işlem yapmadan önce 1–10 adet ile doğrula.
      </p>
    </main>
  )
}
