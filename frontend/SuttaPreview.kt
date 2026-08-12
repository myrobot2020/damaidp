import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SuttaScreen(
    id: String,
    title: String,
    subtitle: String,
    suttaText: String,
    commentaryText: String,
    imageUrl: String? = null
) {
    val scrollState = rememberScrollState()
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFDFCFB)) // "Paper" background
            .padding(safeDrawingPadding())
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "DAMA",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF8B4513)
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 28.dp)
        ) {
            Spacer(modifier = Modifier.height(8.dp))
            
            // Subtitle (Nikaya info)
            Text(
                text = subtitle,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = Color(0xFF8B4513)
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Main Heading
            Text(
                text = title,
                fontSize = 35.sp,
                lineHeight = 40.sp,
                fontWeight = FontWeight.Normal,
                color = Color(0xFF1A1A1A)
            )

            // Image
            if (imageUrl != null) {
                Spacer(modifier = Modifier.height(24.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(22.dp))
                        .border(1.dp, Color(0xFFE5E0D8), RoundedCornerShape(22.dp))
                        .background(Color.White)
                ) {
                    // In a real app we'd load the image, here we just simulate it with a placeholder
                    // or a box with the same color scheme.
                    // Since I can't easily use the actual PNG in Compose Preview without adding it to resources,
                    // I'll use a Placeholder and tell the user.
                    Column(
                        modifier = Modifier.fillMaxWidth().height(200.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Image: AN 5.40 Sāla Trees", color = Color.Gray)
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
            } else {
                Spacer(modifier = Modifier.height(24.dp))
                Divider(color = Color(0xFFE5E0D8))
                Spacer(modifier = Modifier.height(24.dp))
            }

            // Sutta Section
            Text(
                text = "Sutta",
                style = MaterialTheme.typography.labelSmall,
                color = Color.Gray
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = suttaText,
                fontSize = 18.sp,
                lineHeight = 26.sp,
                color = Color(0xFF2C2C2C)
            )

            Spacer(modifier = Modifier.height(28.dp))

            // Commentary Section
            Text(
                text = "Commentary",
                style = MaterialTheme.typography.labelSmall,
                color = Color.Gray
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = commentaryText,
                fontSize = 16.sp,
                lineHeight = 24.sp,
                color = Color(0xFF4A4A4A)
            )
            
            Spacer(modifier = Modifier.height(100.dp))
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable
fun AN540Preview() {
    SuttaScreen(
        id = "AN 5.4.40",
        title = "Sālandana Sutta",
        subtitle = "Aṅguttara Nikāya · Book of Fives · AN 5.4.40",
        suttaText = "monks the great saal trees supported by himalayan the king of the mountains grow in 5 growths what 5 they grow in branches leaves and foliage they grow in bark shoots in pith they grow in heart or heart wood monks the great salt trees or salah trees supported by himalaya the king of the mountains grow in these 5 growths even so amongst folk within a home supported by a believing clan chief grow in 5 growths what 5 they grow in faith in virtue in learning in generosity they grow in wisdom monks folk within the home supported by a believing clan chief grow in these 5 growths",
        commentaryText = "these 5 things that a lay person can grow in are very important good qualities faith virtue learning generosity and wisdom...",
        imageUrl = "/panels/an540.png"
    )
}
