# Standalone PowerShell Script: Dual Master JSON & CSV Ground Truth Generator
# 1. Scans physical disk folders across root & downloads (992 clean suttas)
# 2. Generates master.json as the Single JSON Source of Truth for Web Frontend
# 3. Generates sutta_status_matrix.csv reflecting master.json for R Shiny & Excel Audit

$baseDir = "C:\Users\ADMIN\Desktop\buddha3"
$frontendDir = Join-Path $baseDir "frontendoptimised2"
$downloadsDir = Join-Path $frontendDir "downloads"
$masterJsonFile = Join-Path $frontendDir "master.json"
$csvFile = Join-Path $frontendDir "sutta_status_matrix.csv"

$nikayaFolders = [ordered]@{
    "AN" = "Anguttara Nikaya by Bhante Hye Dhammavuddho Mahathera"
    "MN" = "Majjhima Nikaya by Bhante Hye Dhammavuddho Mahathera"
    "SN" = "Samyutta Nikaya by Bhante Hye Dhammavuddho Mahathera"
    "DN" = "Digha Nikaya by Bhante Hye Dhammavuddho Mahathera"
    "KN" = "Khuddaka Nikaya by Bhante Dhammavuddho Hye Mahathera"
}

$nikayaNames = @{
    "AN" = "Anguttara Nikaya"
    "MN" = "Majjhima Nikaya"
    "SN" = "Samyutta Nikaya"
    "DN" = "Digha Nikaya"
    "KN" = "Khuddaka Nikaya"
}

$entriesMap = [ordered]@{}
$resultsList = [System.Collections.Generic.List[PSObject]]::new()

foreach ($nikCode in $nikayaFolders.Keys) {
    $folderName = $nikayaFolders[$nikCode]
    $mainPath = Join-Path $baseDir $folderName
    $dlPath = Join-Path $downloadsDir $folderName
    
    $uniqueUnits = [ordered]@{}
    
    if (Test-Path $dlPath) {
        Get-ChildItem -Path $dlPath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $cleanName = ($_.Name -replace '\.en(-orig)?$', '') -replace '\s+', ' '
            if ($cleanName -ne "downloads") {
                if (-not $uniqueUnits.Contains($cleanName)) {
                    $uniqueUnits[$cleanName] = [System.Collections.Generic.List[IO.DirectoryInfo]]::new()
                }
                $uniqueUnits[$cleanName].Add($_)
            }
        }
    }
    
    if (Test-Path $mainPath) {
        Get-ChildItem -Path $mainPath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $cleanName = ($_.Name -replace '\.en(-orig)?$', '') -replace '\s+', ' '
            if ($cleanName -ne "downloads") {
                if (-not $uniqueUnits.Contains($cleanName)) {
                    $uniqueUnits[$cleanName] = [System.Collections.Generic.List[IO.DirectoryInfo]]::new()
                }
                $uniqueUnits[$cleanName].Add($_)
            }
        }
    }
    
    $sortedFolderIds = $uniqueUnits.Keys | Sort-Object {
        [regex]::Replace($_, '\d+', { $args[0].Value.PadLeft(8, '0') })
    }
    
    foreach ($folderId in $sortedFolderIds) {
        $dirList = $uniqueUnits[$folderId]
        $formattedId = $folderId -replace '_', '.'
        $sid = "$nikCode $formattedId"
        
        $jsonFiles = [System.Collections.Generic.List[IO.FileInfo]]::new()
        $mp4Files = [System.Collections.Generic.List[IO.FileInfo]]::new()
        $srtFiles = [System.Collections.Generic.List[IO.FileInfo]]::new()
        
        foreach ($dir in $dirList) {
            Get-ChildItem -Path $dir.FullName -Filter "*.json" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $jsonFiles.Add($_) }
            Get-ChildItem -Path $dir.FullName -Filter "*.mp4" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $mp4Files.Add($_) }
            Get-ChildItem -Path $dir.FullName -Filter "*.srt" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $srtFiles.Add($_) }
        }
        
        $title = ""
        $scUrl = ""
        $videoId = ""
        $ts = ""
        $langs = [System.Collections.Generic.HashSet[string]]::new()
        
        $hasSuttaText = $false
        $hasCommentary = $false
        $hasTranscript = $false
        $hasQuiz = $false
        $hasKnowledgeGraph = $false
        $hasMp4 = ($mp4Files.Count -gt 0)
        $hasSrt = ($srtFiles.Count -gt 0)
        $hasMetrics = $false
        $hasJson = $false
        
        $jsonPathRel = if ($jsonFiles.Count -gt 0) { $jsonFiles[0].FullName.Replace("$baseDir\", "") } else { "" }
        $mp4PathRel = if ($hasMp4) { $mp4Files[0].FullName.Replace("$baseDir\", "") } else { "" }
        $srtPathRel = if ($hasSrt) { $srtFiles[0].FullName.Replace("$baseDir\", "") } else { "" }
        $metricsPathRel = ""
        
        $feats = [System.Collections.Generic.HashSet[string]]::new()
        if ($hasMp4) { [void]$feats.Add("MP4") }
        if ($hasSrt) { [void]$feats.Add("SRT") }
        
        foreach ($jf in $jsonFiles) {
            if ($jf.Name -eq "metrics.json") {
                $hasMetrics = $true
                $metricsPathRel = $jf.FullName.Replace("$baseDir\", "")
                [void]$feats.Add("MET")
            } else {
                $hasJson = $true
                if (-not $jsonPathRel) { $jsonPathRel = $jf.FullName.Replace("$baseDir\", "") }
                try {
                    if (Test-Path -Path $jf.FullName -PathType Leaf) {
                        $mtime = [long]($jf.LastWriteTimeUtc - $([datetime]"1970-01-01")).TotalMilliseconds
                        if (-not $ts -or $mtime -gt $ts) { $ts = $mtime }
                        
                        $jsonContent = Get-Content -Raw -Path $jf.FullName -Encoding UTF8 -ErrorAction SilentlyContinue | ConvertFrom-Json
                        if ($jsonContent) {
                            if (-not $title -and $jsonContent.sutta_name) { $title = $jsonContent.sutta_name }
                            if (-not $title -and $jsonContent.sutta_name_en) { $title = $jsonContent.sutta_name_en }
                            if (-not $scUrl -and $jsonContent.sutta_central_link) { $scUrl = $jsonContent.sutta_central_link }
                            if (-not $scUrl -and $jsonContent.sc_url) { $scUrl = $jsonContent.sc_url }
                            if (-not $videoId -and $jsonContent.video_id) { $videoId = $jsonContent.video_id }
                            
                            if ($jsonContent.languages) {
                                $jsonContent.languages.psobject.properties.Name | ForEach-Object { [void]$langs.Add($_) }
                            } else {
                                [void]$langs.Add("en")
                            }
                            
                            if ($jsonContent.sutta -and ([string]$jsonContent.sutta).Trim()) { $hasSuttaText = $true; [void]$feats.Add("TXT") }
                            if ($jsonContent.commentary -and ([string]$jsonContent.commentary).Trim()) { $hasCommentary = $true; [void]$feats.Add("COM") }
                            if ($jsonContent.transcript -and ([string]$jsonContent.transcript).Trim()) { $hasTranscript = $true; [void]$feats.Add("TRN") }
                            if ($jsonContent.quiz -and $jsonContent.quiz.options) { $hasQuiz = $true; [void]$feats.Add("QZ") }
                            if ($jsonContent.knowledge_graph -and $jsonContent.knowledge_graph.nodes) { $hasKnowledgeGraph = $true; [void]$feats.Add("KG") }
                        }
                    }
                } catch {}
            }
        }
        
        $hasVideoAudio = [bool]($videoId)
        if ($hasVideoAudio) { [void]$feats.Add("VID") }
        if ($scUrl) { [void]$feats.Add("SC") }
        foreach ($lk in $langs) { [void]$feats.Add($lk.ToUpper()) }
        
        $hasEn = $langs.Contains("en")
        $hasJp = $langs.Contains("jp")
        $hasAudioAsset = $hasVideoAudio -or $hasMp4
        
        $status = "GHOST"
        $score = 0
        
        if ($hasSuttaText -and $hasCommentary -and $hasTranscript -and ($hasAudioAsset -or $hasSrt)) {
            $status = "COMPLETE"
            $score = 100
        } elseif ($hasJson -or $hasAudioAsset -or $hasSrt) {
            $status = "RAW"
            $score = if ($hasAudioAsset) { 85 } else { 60 }
        } else {
            $status = "GHOST"
            $score = 0
        }
        
        $youtubeUrl = if ($videoId) { "https://www.youtube.com/watch?v=$videoId" } else { "" }
        $featsList = ($feats | Sort-Object) -join " "
        $langsList = ($langs | Sort-Object) -join " "
        $sortedFeatsArray = $feats | Sort-Object
        
        # Build JSON Entry object
        $entryObj = [ordered]@{
            nikaya                = $nikCode.ToLower()
            folder                = $folderId
            title                 = $title
            video_id              = $videoId
            sc_url                = $scUrl
            status                = $status
            last_edited_timestamp = $ts
            active_features_count = $feats.Count
            features_list         = $sortedFeatsArray
            languages             = [ordered]@{
                en = if ($jsonPathRel) { $jsonPathRel } else { "../$($nikayaFolders[$nikCode])/$folderId/$folderId.json" }
            }
        }
        
        if ($hasJp) {
            $entryObj.languages["jp"] = "../$($nikayaFolders[$nikCode])/$folderId/$folderId.jp.json"
        }
        
        $entriesMap[$sid] = $entryObj
        
        # Build CSV Row object
        $row = [PSCustomObject]@{
            sutta_id              = $sid
            title                 = $title
            nikaya                = $nikCode
            nikaya_name           = $nikayaNames[$nikCode]
            folder                = $folderId
            status                = $status
            completion_score_pct  = $score
            has_sutta_text        = $hasSuttaText
            has_commentary        = $hasCommentary
            has_transcript        = $hasTranscript
            has_quiz              = $hasQuiz
            has_knowledge_graph   = $hasKnowledgeGraph
            has_video_audio       = $hasVideoAudio
            has_mp4               = $hasMp4
            has_srt               = $hasSrt
            has_metrics           = $hasMetrics
            has_en_translation    = $hasEn
            has_jp_translation    = $hasJp
            youtube_id            = $videoId
            youtube_url           = $youtubeUrl
            sc_link               = $scUrl
            available_languages   = $langsList
            json_file_path        = $jsonPathRel
            mp4_file_path         = $mp4PathRel
            srt_file_path         = $srtPathRel
            metrics_file_path     = $metricsPathRel
            active_features_count = $feats.Count
            features_list         = $featsList
            last_edited_timestamp = $ts
        }
        
        $resultsList.Add($row)
    }
}

# Build Master JSON payload
$nikayaFoldersJson = [ordered]@{}
foreach ($k in $nikayaFolders.Keys) {
    $nikayaFoldersJson[$k.ToLower()] = $nikayaFolders[$k]
}

$masterData = [ordered]@{
    config = [ordered]@{
        total_entries       = $entriesMap.Count
        nikaya_folders      = $nikayaFoldersJson
        generated_timestamp = [long]((Get-Date).ToUniversalTime() - $([datetime]"1970-01-01")).TotalMilliseconds
    }
    entries = $entriesMap
}

# Write master.json (Single JSON Source of Truth for Frontend)
$masterData | ConvertTo-Json -Depth 10 | Set-Content -Path $masterJsonFile -Encoding UTF8
Write-Host "✓ Generated master.json as Single JSON Source of Truth ($($entriesMap.Count) suttas) -> $masterJsonFile ($((Get-Item $masterJsonFile).Length) bytes)" -ForegroundColor Green

# Write sutta_status_matrix.csv reflecting master.json for R Shiny & Excel
try {
    $resultsList | Export-Csv -Path $csvFile -NoTypeInformation -Encoding UTF8 -Force
    Write-Host "✓ Generated sutta_status_matrix.csv reflecting master.json -> $csvFile ($((Get-Item $csvFile).Length) bytes)" -ForegroundColor Green
} catch {
    Write-Warning "CSV notice: $csvFile (file may be open in Excel). master.json updated cleanly!"
}
