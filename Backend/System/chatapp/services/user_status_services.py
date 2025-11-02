from ..models import Profile

def user_status(user):
        import cloudinary
        # Get all profiles except yourself
        profiles = Profile.objects.exclude(user=user)
        default_public_id = "Default_Image_plhgsj"
        default_url = cloudinary.utils.cloudinary_url(
            default_public_id,
            resource_type="image",
            secure=True
        )[0]
        data = [
    {
        "id": p.user.id,
        "email": p.user.email,
        "name": f"{p.user.name} ",
        "photo":p.user.profile.photo.url if p.user.profile.photo else default_url,
        "is_online": p.is_online
    }
    for p in profiles
]

        return data