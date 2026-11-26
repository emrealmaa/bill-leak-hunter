# Sızıntı Avcısı – Claude Code notları

Projenin tamamı ve kuralları: [PROJE.md](PROJE.md). Çelişki olursa PROJE.md esastır.

## Dosya düzenleme
- Dosyaları **her zaman Edit/Write araçlarıyla** düzenle.
- Dosya içeriğini PowerShell komutlarıyla (`Set-Content`, `Add-Content`, `Out-File`, `>` / `>>` yönlendirme, `Get-Content | ... | Set-Content`) **asla değiştirme**. Windows PowerShell 5.1, BOM'suz UTF-8 dosyaları yanlış okuyup Türkçe karakterleri bozuyor.
- PowerShell'de tırnak içeren argümanlar (commit mesajı, `node -e` kodu) bozulabilir: commit mesajını repo dışındaki geçici bir dosyaya yazıp `git commit -F <dosya>` kullan.
- Kodda bilerek kullanılan "�" (U+FFFD, bilinmeyen glif) `"�"` olarak yazılır; bozuk karakter taramasında yorum/test dışında görünmemeli.
