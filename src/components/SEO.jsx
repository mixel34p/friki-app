import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, keywords, ogTitle, ogDescription, ogImage, twitterCard }) => {
    const siteName = 'GeekSphere';
    const fullTitle = title ? `${title} | ${siteName}` : siteName;

    return (
        <Helmet>
            {/* Standard metadata */}
            <title>{fullTitle}</title>
            {description && <meta name="description" content={description} />}
            {keywords && <meta name="keywords" content={keywords} />}

            {/* Open Graph */}
            <meta property="og:title" content={ogTitle || fullTitle} />
            {ogDescription && <meta property="og:description" content={ogDescription} />}
            {ogImage && <meta property="og:image" content={ogImage} />}
            <meta property="og:type" content="website" />

            {/* Twitter */}
            <meta name="twitter:card" content={twitterCard || 'summary_large_image'} />
            <meta name="twitter:title" content={ogTitle || fullTitle} />
            {ogDescription && <meta name="twitter:description" content={ogDescription} />}
            {ogImage && <meta name="twitter:image" content={ogImage} />}
        </Helmet>
    );
};

export default SEO;
